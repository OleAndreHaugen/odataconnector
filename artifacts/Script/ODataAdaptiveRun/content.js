const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: {
        id: req.body._connector.settings.startParam
    }
});

if (!connector) return complete();


const Service = connector.config.service; //"FAR_CUSTOMER_LINE_ITEMS";
const EntitySet = connector.config.entitySet; //"Items";

let resCount;

let opts = {
    service: Service,
    entitySet: EntitySet,
    parameters: {
        "$inlinecount": "allpages",  // V4 = $count=true
        "$format": "json",
        "$select": "",
        "$filter": "",
    }
}

// ?sap-value-list=all 
// https://docs.mendix.com/refguide/odata-query-options/

// API Query - Filter
const bodyFields = Object.keys(req.body);
let whereSep = "";

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
                let multiFilter = "";
                let sep = "";

                fieldValue.forEach(function (value) {
                    multiFilter += sep + fieldName + " eq '" + value + "'";
                    sep = " or ";
                });

                opts.parameters.$filter += whereSep + "(" + multiFilter + ")";
                break;

            default:
                opts.parameters.$filter += whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                break;

        }

        whereSep = " and ";

    }

});

// API Query - Select
let sep = "";

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

try {

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

