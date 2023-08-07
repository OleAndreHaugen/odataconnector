let selectFields = ["config", "systemid"];
if (req.query.method === "ValueListSetup") selectFields.push("metadata");

// Get Connector Data
const connector = await entities.neptune_af_connector.findOne({
    select: selectFields,
    where: { id: req.body._connector.settings.startParam },
});

if (!connector) return complete();

const SystemId = connector.systemid;
const Service =
    connector.config.source === "xsodata"
        ? connector.config.service + ".xsodata"
        : connector.config.service;
const BaseUrl = connector.config.source === "xsodata" ? "/xsodata/v0/" : "/sap/opu/odata/sap/";

// Process Method
switch (req.query.method) {
    case "ValueListSetup":
        processValueListSetup();
        break;

    case "ValueListRun":
        processValueListRun();
        break;

    case "Delete":
        await processDelete(req);
        break;

    case "Save":
        processSave();
        break;

    default:
        processListAndGet();
        break;
}

async function processDelete() {
    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Delete not currently supported.",
        },
    };

    complete();
}

// ValueList - Selection
async function processValueListSetup() {
    try {
        // Metadata is updated from cockpit app, press update on fields
        const entitySets =
            connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;
        const entityTypes = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;
        const annotations = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;
        const valueLists = [];

        // Find all annotations
        annotations.forEach(function (annotation) {
            if (
                annotation.Target === req.body._valueListTarget &&
                annotation.Annotation.Term === "com.sap.vocabularies.Common.v1.ValueList"
            ) {
                const valueListCollectionPath = annotation.Annotation.Record.PropertyValue.find(
                    (value) => value.Property === "CollectionPath"
                );
                const valueListParameters = annotation.Annotation.Record.PropertyValue.find(
                    (value) => value.Property === "Parameters"
                ).Collection.Record;
                const valueListSearchSupported = annotation.Annotation.Record.PropertyValue.find(
                    (value) => value.Property === "SearchSupported"
                );
                const valueListLabel = annotation.Annotation.Record.PropertyValue.find(
                    (value) => value.Property === "Label"
                );

                let valueListKeyField;
                let valueListFields = [];

                // Value List Fields
                valueListParameters.forEach(function (record) {
                    if (record.PropertyValue.length) {
                        record.PropertyValue.forEach(function (PropertyValue) {
                            if (PropertyValue.Property === "ValueListProperty")
                                valueListFields.push(PropertyValue.String);
                            if (
                                record.Type ===
                                "com.sap.vocabularies.Common.v1.ValueListParameterInOut"
                            )
                                valueListKeyField = PropertyValue.String;
                        });
                    } else {
                        valueListFields.push(record.PropertyValue.String);
                        if (
                            record.Type === "com.sap.vocabularies.Common.v1.ValueListParameterInOut"
                        )
                            valueListKeyField = record.PropertyValue.String;
                    }
                });

                const entitySet = entitySets.find(
                    (entitySets) => entitySets.Name === valueListCollectionPath.String
                );
                const entityTypeName = entitySet.EntityType.split(".");
                const entityType = entityTypes.find(
                    (entityTypes) => entityTypes.Name === entityTypeName[entityTypeName.length - 1]
                );

                //  Value Help Fields
                let fields = [];
                entityType.Property.forEach(function (property) {
                    const field = {
                        type: property.Type.split(".")[1].toLowerCase(),
                        name: property.Name,
                        label: property["sap:label"],
                    };

                    // Value Help
                    if (property["sap:value-list"]) {
                        const valueListTarget = entitySet.EntityType + "/" + property.Name;
                        field.valueListTarget = valueListTarget;
                    }

                    if (valueListFields.includes(property.Name)) fields.push(field);
                });

                let res = {
                    fields: fields,
                    valueListLabel: valueListLabel ? valueListLabel.String : "",
                    valueListKeyField: valueListKeyField,
                    valueListSearchSupported: valueListSearchSupported ? true : false,
                    valueListCollectionPath: valueListCollectionPath.String,
                };

                valueLists.push(res);
            }
        });

        result.data = valueLists;
        complete();
    } catch (e) {
        result.data = {
            error: e,
        };
        complete();
    }
}

async function processValueListRun() {
    let whereSep = "";

    let opts = {
        parameters: {
            $inlinecount: "allpages",
            $format: "json",
            $top: 100,
            $filter: "",
        },
    };

    let SystemUrl =
        BaseUrl +
        Service +
        "/" +
        req.body._entitySet +
        "?$inlinecount=allpages&$format=json&$top=100";

    try {
        // API Query - Filter
        const bodyFields = Object.keys(req.body);

        bodyFields.forEach(function (fieldName) {
            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            // Search Field
            if (fieldName === "_search") {
                opts.parameters.search = fieldValue;
            }

            // Filter Fields
            if (fieldName.substr(0, 1) !== "_") {
                opts.parameters.$filter +=
                    whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                whereSep = " and ";
            }
        });

        if (opts.parameters.$filter) SystemUrl += "&$filter=" + opts.parameters.$filter;
        if (opts.parameters.search) SystemUrl += "&search=" + opts.parameters.search;
        if (opts.parameters.$orderby) SystemUrl += "&$orderby=" + opts.parameters.$orderby;

        const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

        result.data = {
            result: res.data.d.results,
            count: res.data.d.__count,
            debug: {
                req: req.body,
                opts: opts,
            },
        };

        return complete();
    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts,
            },
        };
        return complete();
    }
}

// List Data
async function processListAndGet() {
    let sep = "";
    let whereSep = "";
    let keysSep = "";
    let multiFilter = "";

    let SystemUrl =
        BaseUrl +
        Service +
        "/" +
        connector.config.entitySet +
        "_xsodatakey_?$inlinecount=allpages&$format=json";

    let opts = {
        parameters: {
            $inlinecount: "allpages",
            $format: "json",
            $orderby: "",
            $select: "",
            $filter: "",
            $keys: "",
        },
    };

    try {
        // Different Handling from Get vs List
        if (req.query.method == "Get") {
            // API Query - Select
            if (req.body._settings.fieldsSel) {
                req.body._settings.fieldsSel.forEach(function (field) {
                    opts.parameters.$select += sep + field.name;
                    sep = ",";
                });
            }

            // API Query - Filter From Adaptive Designer
            if (req.body._keyField) {
                req.body._keyField.forEach(function (keyField) {
                    opts.parameters.$keys +=
                        keysSep + `${keyField.fieldName}='${req.body[keyField.fieldName]}'`;
                    keysSep = ",";
                });
                SystemUrl =
                    BaseUrl +
                    Service +
                    "/" +
                    connector.config.entitySet +
                    "(" +
                    opts.parameters.$keys +
                    ")?$format=json";
            } else {
                // API Query - Filter Metadata
                if (req.body.__metadata && req.body.__metadata.uri) {
                    const parts = req.body.__metadata.uri.split("/");
                    SystemUrl = BaseUrl + Service + "/" + parts[parts.length - 1] + "?$format=json";
                }
            }
        } else {
            // API Query - Select
            if (req.body._settings.fieldsRun) {
                req.body._settings.fieldsRun.forEach(function (field) {
                    opts.parameters.$select += sep + field.name;
                    sep = ",";
                });
            }

            // API Query - Filter
            const bodyFields = Object.keys(req.body);

            bodyFields.forEach(function (fieldName) {
                if (fieldName.substr(0, 1) !== "_") {
                    const fieldValue = req.body[fieldName];
                    if (!fieldValue) return;

                    const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
                    if (!fieldSel) return;

                    if (fieldSel.type === "RecordKeyOData") {
                        opts.parameters.$keys += keysSep + `${fieldName}='${fieldValue}'`;
                        keysSep = ",";
                    } else {
                        switch (fieldSel.type) {
                            case "CheckBox":
                            case "Switch":
                                opts.parameters.$filter +=
                                    whereSep + " " + fieldName + " = " + fieldValue;
                                break;

                            case "DateRange":
                                opts.parameters.$filter +=
                                    whereSep + " " + fieldName + " >= " + fieldValue;
                                whereSep = " and ";
                                opts.parameters.$filter +=
                                    whereSep +
                                    " " +
                                    fieldName +
                                    " <= " +
                                    req.body[fieldName + "_end"];
                                break;

                            case "SingleSelect":
                            case "SingleSelectLookup":
                            case "SingleSelectScript":
                                if (fieldMeta.type === "datetime") {
                                    opts.parameters.$filter +=
                                        whereSep + " " + fieldName + " = " + fieldValue;
                                } else {
                                    opts.parameters.$filter +=
                                        whereSep + " " + fieldName + " = '" + fieldValue + "'";
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
                                    multiFilter += sep + `substringof('${value}',${fieldName})`;
                                    sep = " or ";
                                });

                                opts.parameters.$filter += whereSep + multiFilter;
                                break;

                            default:
                                if (fieldSel.selEqual) {
                                    opts.parameters.$filter +=
                                        whereSep + `${fieldName} eq'${fieldValue}'`;
                                } else {
                                    opts.parameters.$filter +=
                                        whereSep + `substringof('${fieldValue}',${fieldName})`;
                                }
                                break;
                        }

                        whereSep = " and ";
                    }
                }
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

        // ODATA Keys
        if (opts.parameters.$keys)
            SystemUrl = SystemUrl.replace("_xsodatakey_", `(${opts.parameters.$keys})`);
        SystemUrl = SystemUrl.replace("_xsodatakey_", "");

        // Filter
        if (opts.parameters.$filter) SystemUrl += "&$filter=" + opts.parameters.$filter;
        if (opts.parameters.$top) SystemUrl += "&$top=" + opts.parameters.$top;
        if (opts.parameters.$skip) SystemUrl += "&$skip=" + opts.parameters.$skip;
        if (opts.parameters.$orderby) SystemUrl += "&$orderby=" + opts.parameters.$orderby;
        if (opts.parameters.$select) SystemUrl += "&$select=" + opts.parameters.$select;

        const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

        // Adaptive Framework Binding
        if (res.data && res.data.d) {
            if (res.data.d.results && res.data.d.results.length) {
                res.data.d.results.forEach(function (row) {
                    formatData(row);
                });
            } else {
                formatData(res.data.d);
            }
        }

        if (req.query.method === "Get") {
            if (res.message) {
                let errorMessage = res.message;

                if (res.data && res.data.error && res.data.error.message) {
                    errorMessage = res.data.error.message.value;
                }

                result.data = {
                    status: "ERROR",
                    message: {
                        text: errorMessage,
                    },
                    debug: {
                        opts,
                        SystemUrl,
                    },
                };
            } else {
                result.data = res.data.d;
            }
        } else {
            if (res.message) {
                let errorMessage = res.message;

                if (res.data && res.data.error && res.data.error.message) {
                    errorMessage = res.data.error.message.value;
                }

                result.data = {
                    status: "ERROR",
                    data: res,
                    message: {
                        text: errorMessage,
                    },
                    debug: {
                        opts,
                        SystemUrl,
                    },
                };
            } else {
                result.data = {
                    result: res.data.d.results,
                    count: res.data.d.__count,
                    debug: {
                        opts,
                        SystemUrl,
                    },
                };
            }
        }
        complete();
    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts,
                url: SystemUrl,
            },
        };
        complete();
    }
}

async function processSave() {
    let dataPatch = {};
    let sep = "";
    let resSave;
    let resFetch;
    let entitySet;

    let opts = {
        body: null,
        method: "GET",
        headers: {
            "X-CSRF-Token": "fetch",
            cookie: "",
        },
    };

    // API Query - Select & Data
    req.body._settings.fieldsSel.forEach(function (field) {
        dataPatch[field.name] = req.body[field.name];
    });

    // API Query - Record ID
    if (req.body.__metadata && req.body.__metadata.id) {
        const parts = req.body.__metadata.id.split("/");
        entitySet = parts[parts.length - 1];
    }

    try {
        // GET X-CSRF-TOKEN
        let SystemUrl = BaseUrl + Service + "/" + entitySet + "?$format=json";

        // if (opts.parameters.$select) SystemUrl += "&$select=" + opts.parameters.$select;

        resFetch = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json", opts);

        // console.log(resFetch.headers);

        opts.headers["X-CSRF-Token"] = resFetch.headers.get("x-csrf-token");
        opts.headers["cookie"] = resFetch.headers.get("set-cookie");

        opts.method = "PATCH";
        opts.body = JSON.stringify(dataPatch);
        // opts.body = resFetch.data;

        // delete opts.parameters.$select;

        // TODO: Problem is csrf validation
        // Need both Cookie + x-csrf-token in SAVE Request

        // SAVE
        SystemUrl = BaseUrl + Service + "/" + connector.config.entitySet;

        resSave = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json", opts);

        if (resSave.message) {
            result.data = {
                status: "ERROR",
                message: {
                    text: resSave.message,
                },
                debug: {
                    opts,
                    dataPatch,
                    SystemUrl,
                },
            };
        } else {
            result.data = {
                status: "OK",
                debug: {
                    opts,
                    dataPatch,
                },
            };
        }

        complete();
    } catch (error) {
        let errorMessage = "";
        if (error && error.message) errorMessage = error.message;

        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                dataPatch,
                opts: opts,
            },
            message: {
                text: errorMessage,
            },
        };
        complete();
    }
}

async function formatData(row) {
    rowFields = Object.keys(row);

    rowFields.forEach(function (fieldName) {
        // DateTime Format
        if (row[fieldName]?.indexOf && row[fieldName].indexOf("/Date(") > -1) {
            const raw = row[fieldName].split("/Date(")[1];
            row[fieldName] = parseInt(raw);
        }
    });
}
