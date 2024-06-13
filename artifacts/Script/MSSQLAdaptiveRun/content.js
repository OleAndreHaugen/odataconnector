// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam },
});

if (!connector) return complete();

let selectedFields = [];

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

            if (fieldName.indexOf(".") > -1) {
                fieldNameFormatted = formatJoinField(fieldName);
            }

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
            // Fields from FieldCatalog
            req.body._settings.fieldsRun.forEach(function (field) {
                if (field.name.indexOf(".") === -1) {
                    fields += sep + `"${connector.config.table}"."${field.name}"`;
                    sep = ",";
                } else {
                    fields += sep + formatJoinField(field.name, true);
                    sep = ",";
                }
            });

            // Joins
            selectedFields.forEach(function (fieldMeta) {
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
                        joins += ` left join "${fieldMeta.joinTable}" AS ${fieldMeta.joinTable} ${joinString}`;
                    }
                }
            });
        } else {
            return { error: "No fields to display in table" };
        }

        // Count
        statementCount = `select count(*) as __COUNTER from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

        const resCount = await globals.Utils.MSSQLExec(connector.systemid, statementCount);

        if (resCount.error) {
            result.data = {
                resCount,
                debug: {
                    count: statementCount,
                },
            };
            return complete();
        }

        // All if no fields are specified
        if (!fields) fields = "*";

        // SQL Statement
        statementExec = `select ${fields} from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

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
                    statementExec += ` order by ${orderField} ${orderType}`;
                }
            }
        }

        // Pagination
        if (req.body._pagination) {
            statementExec += ` offset ${req.body._pagination.skip} rows fetch next ${req.body._pagination.take} rows only`;
        }

        // Query Table
        const resData = await globals.Utils.MSSQLExec(connector.systemid, statementExec);

        if (resData.error) {
            result.data = {
                status: "ERROR",
                message: resData.error,
            };
            return complete();
        } else {
            result.data = {
                count: resCount.recordset[0]["__COUNTER"],
                result: resData.recordset,
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
    const bodyFields = Object.keys(req.body);

    let where = "";
    let sep = "";
    let fields = "";
    let values = "";
    let statement = "";

    // Find Unique Row ID
    connector.config.fields.forEach(async function (field) {
        if (field.is_identity && req.body[field.name]) {
            where += `${sep} ${field.name} = '${req.body[field.name]}'`;
            sep = " and ";
        }
    });

    sep = "";

    // Insert vs Update
    if (!where) {
        bodyFields.forEach(function (fieldName) {
            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
            if (!fieldSel) return;

            const fieldMeta = connector.config.fields.find((f) => f.name === fieldName);
            if (fieldMeta.autoFill) return;

            fields += sep + fieldSel.name;
            values += `${sep}'${fieldValue}'`;
            sep = ",";
        });

        // Autofill
        connector.config.fields.forEach(function (field) {
            if (field.autoFill) {
                let value = "";

                switch (field.autoFill) {
                    case "at":
                        value = new Date().toISOString();
                        break;

                    case "by":
                        value = req.user.username;
                        break;
                }

                fields += sep + field.name;
                values += `${sep}'${value}'`;
                sep = ",";
            }
        });

        statement = `INSERT INTO "${connector.config.schema}"."${connector.config.table}" (${fields}) VALUES (${values})`;
    } else {
        bodyFields.forEach(function (fieldName) {
            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
            if (!fieldSel) return;

            const fieldMeta = connector.config.fields.find((f) => f.name === fieldName);
            if (fieldMeta.is_identity) return;
            if (fieldMeta.autoFill) return;

            fields += `${sep}${fieldSel.name} = '${fieldValue}'`;
            sep = ",";
        });

        // Autofill
        connector.config.fields.forEach(function (field) {
            if (field.autoFill) {
                let value = "";

                switch (field.autoFill) {
                    case "at":
                        value = new Date().toISOString();
                        break;

                    case "by":
                        value = req.user.username;
                        break;
                }

                fields += `${sep}${field.name} = '${value}'`;
                sep = ",";
            }
        });

        statement = `UPDATE "${connector.config.schema}"."${connector.config.table}" SET ${fields} WHERE ${where}`;
    }

    const res = await globals.Utils.MSSQLExec(connector.systemid, statement);

    if (res.error) {
        result.data = {
            status: "ERROR",
            message: res.error,
            debug: statement,
        };
    } else {
        result.data = "OK";
    }

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
        if (req.body._keyField) {
            req.body._keyField.forEach(function (keyField) {
                let fieldNameFormatted = `"${connector.config.table}"."${keyField.fieldName}"`;

                if (keyField.fieldName.indexOf(".") > -1) {
                    fieldNameFormatted = formatJoinField(keyField.fieldName);
                }

                where += sep + `${fieldNameFormatted} = '${req.body[keyField.fieldName]}'`;
                sep = " and ";
            });
        } else {
            result.data = {
                message: {
                    text: "No field mapping is defined in ItemPress Event",
                },
            };
            return complete();
        }

        if (where) where = "where " + where;

        // Selected Fields
        sep = "";
        if (req.body._settings.fieldsSel) {
            req.body._settings.fieldsSel.forEach(function (field) {
                if (field.name.indexOf(".") === -1) {
                    fields += sep + `"${connector.config.table}"."${field.name}"`;
                    sep = ",";
                } else {
                    fields += sep + formatJoinField(field.name, true);
                    sep = ",";
                }
            });

            // Joins
            selectedFields.forEach(function (fieldMeta) {
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
                        joins += ` left join "${fieldMeta.joinTable}" AS ${fieldMeta.joinTable} ${joinString}`;
                    }
                }
            });
        }

        // SQL Statement
        statement = `select top 1 ${fields} from "${connector.config.schema}"."${connector.config.table}" as ${connector.config.table} ${joins} ${where}`;

        // Query Table
        const resData = await globals.Utils.MSSQLExec(connector.systemid, statement);

        if (resData.error) {
            result.data = {
                status: "ERROR",
                message: resData.error,
                debug: statement,
            };
        } else {
            result.data = resData.recordset[0];
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
    let where = "";
    let sep = "";

    // Find Unique Row ID
    connector.config.fields.forEach(async function (field) {
        if (field.is_identity && req.body.data[field.name]) {
            where += `${sep} ${field.name} = '${req.body.data[field.name]}'`;
            sep = " and ";
        }
    });

    if (!where) {
        result.data = {
            status: "ERROR",
            message: {
                type: "error",
                text: "No field with is_identity found. Delete not possible",
            },
        };
        return;
    }

    // SQL Statement
    statement = `delete from "${connector.config.schema}"."${connector.config.table}" where ${where}`;

    // Query Table
    const res = await globals.Utils.MSSQLExec(connector.systemid, statement);

    if (res.error) {
        result.data = {
            status: "ERROR",
            message: res.error,
            debug: statement,
        };
    } else {
        result.data = "OK";
    }

    complete();
}

function formatJoinField(fieldName, inFieldList) {
    let parts = fieldName.split(".");

    if (inFieldList) {
        return `"${parts[0]}"."${parts[1]}" as "${parts[0]}.${parts[1]}"`;
    } else {
        return `"${parts[0]}"."${parts[1]}"`;
    }
}

async function getFields() {
    connector.config.fields.forEach(async function (field) {
        if (field.sel) selectedFields.push(field);
    });
}
