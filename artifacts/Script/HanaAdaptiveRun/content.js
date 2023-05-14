// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam },
});

if (!connector) return complete();

let selectedFields = [];

const client = await globals.Utils.HANAConnect(connector.systemid);

if (client.error) {
    result.data = client;
    return complete();
}

// Get all selected fields
await getFields();

try {
    // Process Method
    switch (req.query.method) {
        case "Delete":
            processDelete();
            break;

        case "Save":
            processSave();
            break;

        case "Get":
            processGet();
            break;

        default:
            processList();
            break;
    }
} catch (e) {
    result.data = {
        status: "ERROR",
        message: e,
    };

    complete();
}

async function processList() {
    let sep = "";
    let fields = "";
    let joins = "";
    let where = "";
    let statementExec;
    let statementCount;

    try {
        // Where
        const bodyFields = Object.keys(req.body);

        bodyFields.forEach(function (fieldName) {
            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
            if (!fieldSel) return;

            let fieldNameFormatted = `"${connector.config.table}"."${fieldName}"`;
            if (fieldName.indexOf(".") > -1) fieldNameFormatted = formatJoinField(fieldName);

            switch (fieldSel.type) {
                case "CheckBox":
                case "Switch":
                case "SingleSelect":
                case "SingleSelectLookup":
                case "SingleSelectScript":
                    where += sep + `${fieldNameFormatted} = '${fieldValue}'`;
                    break;

                case "MultiSelect":
                case "MultiSelectLookup":
                case "MultiSelectScript":
                    where += sep + `${fieldNameFormatted} IN (${fieldValue})`;
                    break;

                default:
                    if (fieldSel.selEqual) {
                        where += sep + `${fieldNameFormatted} = '${fieldValue}'`;
                    } else {
                        where += sep + `${fieldNameFormatted} LIKE '%${fieldValue}%'`;
                    }
                    sep = " and ";
                    break;
            }
        });

        if (where) where = "where " + where;

        // Selected Fields
        sep = "";

        if (req.body._settings.fieldsRun) {
            req.body._settings.fieldsRun.forEach(function (field) {
                const fieldMeta = selectedFields.find((f) => f.name === field.name);

                // Fields
                if (field.name.indexOf(".") === -1) {
                    fields += sep + `"${connector.config.table}"."${field.name}"`;
                    sep = ",";
                } else {
                    fields += sep + formatJoinField(field.name);
                    sep = ",";
                }

                // Joins
                if (fieldMeta && fieldMeta.joinTable && fieldMeta.joinFields) {
                    let joinSep = "ON";
                    let joinString = "";

                    fieldMeta.joinFields.forEach(function (joinData) {
                        if (joinData.joinField) {
                            joinString += ` ${joinSep} "${connector.config.table}"."${joinData.joinField}" = "${fieldMeta.joinTable}"."${joinData.name}"`;
                            joinSep = "AND";
                        }

                        if (joinData.joinValue) {
                            joinString += ` ${joinSep} "${fieldMeta.joinTable}"."${joinData.name}" = '${joinData.joinValue}'`;
                            joinSep = "AND";
                        }
                    });

                    if (joinString) {
                        joins += ` JOIN "${fieldMeta.joinTable}" AS ${fieldMeta.joinTable} ${joinString}`;
                    }
                }
            });
        } else {
            return { error: "No fields to display in table" };
        }

        // Count - Tricky with distinct and joins
        let countExpression = "";

        if (joins) {
            let field = req.body._settings.fieldsRun[0];

            if (field.name.indexOf(".") === -1) {
                countExpression += `count(distinct "${connector.config.table}"."${field.name}") as __COUNTER`;
            } else {
                countExpression += `count(distinct formatJoinField(field.name)) as __COUNTER`;
            }
        } else {
            countExpression = "count(*) as __COUNTER";
        }

        statementCount = `select ${countExpression} from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

        const resCount = await globals.Utils.HANAExec(client, statementCount);

        if (resCount.error) {
            result.data = resCount;
            return complete();
        }

        // All if no fields are specified
        if (!fields) fields = "*";

        // SQL Statement
        statementExec = `select distinct ${fields} from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

        // Sorting
        if (req.body._order) {
            let orderField = Object.keys(req.body._order)[0];

            if (orderField) {
                let orderType = req.body._order[orderField].toLowerCase();
                if (orderType === "asc") orderType = "";

                if (orderField.indexOf(".") === -1) {
                    statementExec += ` order by "${orderField}" ${orderType}`;
                } else {
                    orderField = formatJoinField(orderField);
                    log.info(orderField);
                    statementExec += ` order by ${orderField} ${orderType}`;
                }
            }
        }

        // Pagination
        if (req.body._pagination) {
            statementExec += ` limit ${req.body._pagination.take} offset ${req.body._pagination.skip}`;
        }

        // Query Table
        const resData = await globals.Utils.HANAExec(client, statementExec);

        if (resData.error) {
            result.data = {
                status: "ERROR",
                message: resData.error,
            };
            return complete();
        } else {
            // Format Result Data (JOIN Fields must be returned correct)
            if (resData && resData.length) {
                resData.forEach(function (row) {
                    req.body._settings.fieldsRun.forEach(function (field) {
                        if (field.name.indexOf(".") > -1) {
                            const parts = field.name.split(".");
                            if (row[parts[1]]) row[field.name] = row[parts[1]];
                        }
                    });
                });
            }

            result.data = {
                count: resCount[0]["__COUNTER"],
                result: resData,
                debug: {
                    run: statementExec,
                    count: statementCount,
                },
            };
        }

        complete();
    } catch (e) {
        result.data = {
            result: e,
            debug: {
                run: statementExec,
                count: statementCount,
                where,
            },
        };
        complete();
    }
}

async function processSave() {
    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Save not supported.",
        },
    };

    complete();
}

async function processGet() {
    let sep = "";
    let fields = "";
    let where = "";
    let joins = "";
    let statement;

    try {
        // Where
        req.body._keyField.forEach(function (keyField) {
            let fieldNameFormatted = `"${connector.config.table}"."${keyField.fieldName}"`;
            if (keyField.fieldName.indexOf(".") > -1)
                fieldNameFormatted = formatJoinField(keyField.fieldName);

            where += sep + `${fieldNameFormatted} = '${req.body[keyField.fieldName]}'`;
            sep = " and ";
        });

        if (where) where = "where " + where;

        // Selected Fields
        sep = "";
        if (req.body._settings.fieldsSel) {
            req.body._settings.fieldsSel.forEach(function (field) {
                const fieldMeta = selectedFields.find((f) => f.name === field.name);

                // Fields
                if (field.name.indexOf(".") === -1) {
                    fields += sep + `"${connector.config.table}"."${field.name}"`;
                    sep = ",";
                } else {
                    fields += sep + formatJoinField(field.name);
                    sep = ",";
                }

                // Joins
                if (fieldMeta && fieldMeta.joinTable && fieldMeta.joinFields) {
                    let joinSep = "ON";
                    let joinString = "";

                    fieldMeta.joinFields.forEach(function (joinData) {
                        if (joinData.joinField) {
                            joinString += ` ${joinSep} "${connector.config.table}"."${joinData.joinField}" = "${fieldMeta.joinTable}"."${joinData.name}"`;
                            joinSep = "AND";
                        }

                        if (joinData.joinValue) {
                            joinString += ` ${joinSep} "${fieldMeta.joinTable}"."${joinData.name}" = '${joinData.joinValue}'`;
                            joinSep = "AND";
                        }
                    });

                    if (joinString) {
                        joins += ` JOIN "${fieldMeta.joinTable}" AS ${fieldMeta.joinTable} ${joinString}`;
                    }
                }
            });
        }

        // SQL Statement
        statement = `select distinct ${fields} from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

        // Query Table
        const resData = await globals.Utils.HANAExec(client, statement);

        if (resData.error) {
            result.data = {
                status: "ERROR",
                message: resData.error,
                debug: statement,
            };
        } else {
            // Format Result Data (JOIN Fields must be returned correct)
            if (resData && resData.length) {
                resData.forEach(function (row) {
                    req.body._settings.fieldsSel.forEach(function (field) {
                        if (field.name.indexOf(".") > -1) {
                            const parts = field.name.split(".");
                            if (row[parts[1]]) row[field.name] = row[parts[1]];
                        }
                    });
                });
            }

            result.data = resData;
        }

        complete();
    } catch (e) {
        result.data = {
            result: e,
            debug: {
                run: statement,
                joins,
            },
        };
        complete();
    }
}

async function processDelete() {
    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Delete not supported.",
        },
    };

    complete();
}

function formatJoinField(fieldName) {
    let parts = fieldName.split(".");
    return `"${parts[0]}"."${parts[1]}"`;
}

async function getFields() {
    connector.config.fields.forEach(async function (field) {
        if (field.sel) {
            selectedFields.push(field);
        }
    });
}
