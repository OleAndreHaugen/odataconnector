let selectFields = ["config"];
if (req.query.method === "ValueListSetup" || req.query.method === "ValueListRun") selectFields.push("metadata");

// Get Connector Data
const connector = await entities.neptune_af_connector.findOne({
    select: selectFields,
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

const Service = connector.config.service;


// Process Method
switch (req.query.method) {

    case "ValueListSetup":
        processValueListSetup();
        break;

    case "ValueListRun":
        processValueListRun();
        break;

    default:
        processList();
        break;
}


// ValueList - Selection
async function processValueListSetup() {

    try {

        // Metadata is updated from cockpit app, press update on fields
        const entitySets = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;
        const entityTypes = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;
        const annotations = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;

        const annotation = annotations.find(annotations => annotations.Target === req.body._valueListTarget);

        if (annotation) {

            const valueListCollectionPath = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "CollectionPath");
            const valueListParameters = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "Parameters").Collection.Record;
            const valueListSearchSupported = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "SearchSupported");
            const valueListLabel = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "Label");

            let valueListKeyField;
            let valueListFields = [];

            // Value List Fields
            valueListParameters.forEach(function (record) {

                if (record.PropertyValue.length) {

                    record.PropertyValue.forEach(function (PropertyValue) {
                        if (PropertyValue.Property === "ValueListProperty") valueListFields.push(PropertyValue.String);
                        if (record.Type === "com.sap.vocabularies.Common.v1.ValueListParameterInOut") valueListKeyField = PropertyValue.String;
                    });

                } else {

                    valueListFields.push(record.PropertyValue.String);
                    if (record.Type === "com.sap.vocabularies.Common.v1.ValueListParameterInOut") valueListKeyField = record.PropertyValue.String;

                }

            });

            const entitySet = entitySets.find(entitySets => entitySets.Name === valueListCollectionPath.String);
            const entityTypeName = entitySet.EntityType.split(".");
            const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);

            // // Value Help Fields
            let fields = [];
            entityType.Property.forEach(function (property) {

                const field = {
                    type: property.Type.split(".")[1].toLowerCase(),
                    name: property.Name,
                    label: property["sap:label"],
                }

                // Value Help
                if (property["sap:value-list"]) {
                    const valueListTarget = entitySet.EntityType + "/" + property.Name;
                    field.valueListTarget = valueListTarget;
                }

                if (valueListFields.includes(property.Name)) fields.push(field);

            })

            let res = {
                fields: fields,
                valueListLabel: (valueListLabel ? valueListLabel.String : valueListCollectionPath.String),
                valueListKeyField: valueListKeyField,
                valueListFields,
                valueListParameters
            }

            if (valueListSearchSupported) {
                res.valueListSearchSupported = true;
            }

            result.data = res;
            complete();

        } else {
            result.data = {
                error: "No annotation found",
                valueListTarget: req.body._valueListTarget

            }
            complete();
        }

    } catch (e) {

        result.data = {
            error: e

        }
        complete();

    }

}

async function processValueListRun() {

    const annotations = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;
    const annotation = annotations.find(annotations => annotations.Target === req.body._valueListTarget);
    const valueListCollectionPath = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "CollectionPath");

    let opts = {
        service: Service,
        entitySet: valueListCollectionPath.String,
        parameters: {
            "$inlinecount": "allpages",
            "$format": "json",
            "$top": 100,
            "$filter": "",
        }
    }


    try {

        // API Query - Filter
        const bodyFields = Object.keys(req.body);
        let whereSep = "";

        bodyFields.forEach(function (fieldName) {

            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            // Search Field
            if (fieldName === "_search") {
                opts.parameters.search = fieldValue;
            }

            // Filter Fields
            if (fieldName.substr(0, 1) !== "_") {
                opts.parameters.$filter += whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                whereSep = " and ";
            }

        });

        const res = await apis.get(opts);

        result.data = {
            result: res.data.d.results,
            count: res.data.d.__count,
            debug: {
                res: res.data,
                req: req.body,
                opts: opts.parameters,
            }
        }

        return complete();

    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts.parameters
            }

        }
        return complete();
    }

}


// List Data
async function processList() {

    let opts = {
        service: Service,
        entitySet: connector.config.entitySet,
        parameters: {
            "$inlinecount": "allpages",
            "$format": "json",
            "$select": "",
            "$filter": "",
        }
    }

    try {

        // API Query - Filter
        const bodyFields = Object.keys(req.body);
        let whereSep = "";
        let multiFilter = "";
        let sep = "";

        bodyFields.forEach(function (fieldName) {

            if (fieldName.substr(0, 1) !== "_") {

                const fieldValue = req.body[fieldName];
                if (!fieldValue) return;

                const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
                if (!fieldSel) return;

                switch (fieldSel.type) {

                    case "CheckBox":
                    case "Switch":
                        opts.parameters.$filter += whereSep + " " + fieldName + " = " + fieldValue;
                        break;

                    case "DateRange":
                        opts.parameters.$filter += whereSep + " " + fieldName + " >= " + fieldValue;
                        whereSep = " and ";
                        opts.parameters.$filter += whereSep + " " + fieldName + " <= " + req.body[fieldName + "_end"];
                        break;

                    case "SingleSelect":
                    case "SingleSelectLookup":
                    case "SingleSelectScript":
                        if (fieldMeta.type === "datetime") {
                            opts.parameters.$filter += whereSep + " " + fieldName + " = " + fieldValue;
                        } else {
                            opts.parameters.$filter += whereSep + " " + fieldName + " = '" + fieldValue + "'";
                        }
                        break;

                    case "MultiSelect":
                    case "MultiSelectLookup":
                    case "MultiSelectScript":
                    case "ValueHelpOData":
                        multiFilter = "";
                        sep = "";

                        fieldValue.forEach(function (value) {
                            multiFilter += sep + fieldName + " eq '" + value + "'";
                            sep = " or ";
                        });

                        opts.parameters.$filter += whereSep + "(" + multiFilter + ")";
                        break;

                    case "ValueHelpOData":
                        multiFilter = "";
                        sep = "";

                        fieldValue.forEach(function (value) {
                            multiFilter += sep + "substringof(" + fieldName + "," + "'" + value + "')";
                            sep = " or ";
                        });

                        opts.parameters.$filter += whereSep + multiFilter;
                        break;

                    default:
                        opts.parameters.$filter += whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                        break;

                }

                whereSep = " and ";

            }

        });

        // API Query - Select
        sep = "";

        if (req.body._settings.fieldsRun) {
            req.body._settings.fieldsRun.forEach(function (field) {
                opts.parameters.$select += sep + field.name;
                sep = ",";
            });
        }

        // API Query - Pagination
        if (req.body._pagination) {
            opts.parameters.$top = req.body._pagination.take;
            opts.parameters.$skip = req.body._pagination.skip;
        }

        // API Query - Order
        if (req.body._order) {

            const orderField = Object.keys(req.body._order)[0];

            if (orderField) {
                const orderType = req.body._order[orderField];
                opts.parameters.$orderby = orderField + " " + orderType.toLowerCase();
            }

        }

        const res = await apis.get(opts);

        // Adaptive Framework Binding 
        res.data.d.results.forEach(function (row) {

            rowFields = Object.keys(row);

            rowFields.forEach(function (fieldName) {

                const fieldRun = req.body._settings.fieldsRun.find((f) => f.name === fieldName);

                if (fieldRun) {

                    switch (fieldRun.type) {

                        case "ObjectStatus":

                            // Unit
                            if (fieldRun.statusUnitType === "Binding") row[fieldName + "_unit"] = row[fieldRun.statusUnitBinding];
                            if (fieldRun.statusUnitType === "Fixed") row[fieldName + "_unit"] = fieldRun.statusUnitFixed;

                            // State
                            if (fieldRun.statusStateType === "Binding") row[fieldName + "_state"] = row[fieldRun.statusStateBinding];
                            if (fieldRun.statusStateType === "Fixed") row[fieldName + "_state"] = fieldRun.statusStateFixed;

                            // Icon
                            if (fieldRun.statusIconType === "Binding") row[fieldName + "_icon"] = row[fieldRun.statusIconBinding];
                            if (fieldRun.statusIconType === "Fixed") row[fieldName + "_icon"] = fieldRun.statusIconFixed;

                            // Title
                            if (fieldRun.statusTitleType === "Binding") row[fieldName + "_title"] = row[fieldRun.statusTitleBinding];
                            if (fieldRun.statusTitleType === "Fixed") row[fieldName + "_title"] = fieldRun.statusTitleFixed;

                            break;

                        case "ObjectNumber":

                            // Unit
                            if (fieldRun.numberUnitType === "Binding") row[fieldName + "_unit"] = row[fieldRun.numberUnitBinding];
                            if (fieldRun.numberUnitType === "Fixed") row[fieldName + "_unit"] = fieldRun.numberUnitFixed;

                            // State
                            if (fieldRun.numberStateType === "Binding") row[fieldName + "_state"] = row[fieldRun.numberStateBinding];
                            if (fieldRun.numberStateType === "Fixed") row[fieldName + "_state"] = fieldRun.numberStateFixed;

                            break;

                        default:
                            break;
                    }
                }

                // DateTime Format 
                if (row[fieldName].indexOf && row[fieldName].indexOf("/Date(") > -1) {
                    const raw = row[fieldName].split("/Date(")[1];
                    row[fieldName] = parseInt(raw);
                }

            });

        });

        result.data = {
            result: res.data.d.results,
            count: res.data.d.__count,
            debug: {
                res: res.data,
                req: req.body,
                opts: opts.parameters,
            }
        }

        complete();

    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts.parameters
            }

        }
        complete();
    }

}