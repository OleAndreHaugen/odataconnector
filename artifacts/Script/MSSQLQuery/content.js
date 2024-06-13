// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.query.id },
});

if (!connector) return complete();

let sep = "";
let fields = "";
let joins = "";
let where = "";
let statementExec;
let statementCount;

try {
    // Where
    if (req.body.filter) {
        const bodyFields = Object.keys(req.body.filter);

        bodyFields?.forEach(function (fieldName) {
            const fieldValue = req.body.filter[fieldName];
            if (!fieldValue) return;

            let fieldNameFormatted = `"${connector.config.table}"."${fieldName}"`;

            if (fieldName.indexOf(".") > -1) {
                fieldNameFormatted = formatJoinField(fieldName);
            }

            where += sep + `${fieldNameFormatted} LIKE '%${fieldValue}%'`;
            sep = " AND ";
        });

        if (where) where = "WHERE " + where;

        sep = "";
    }

    // Fields
    req.body.fields?.forEach(function (field) {
        if (field.name.indexOf(".") === -1) {
            fields += sep + `"${connector.config.table}"."${field.name}"`;
            sep = ",";
        } else {
            fields += sep + formatJoinField(field.name, true);
            sep = ",";
        }
    });

    // Joins
    req.body.fields?.forEach(function (fieldMeta) {
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
    let orderField = req.body.sortField;

    if (orderField.indexOf(".") === -1) {
        statementExec += ` order by [${orderField}] ${req.body.sortOrder}`;
    } else {
        orderField = formatJoinField(orderField);
        statementExec += ` order by [${orderField}] ${req.body.sortOrder}`;
    }

    // Pagination;
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

function formatJoinField(fieldName, inFieldList) {
    let parts = fieldName.split(".");

    if (inFieldList) {
        return `"${parts[0]}"."${parts[1]}" as "${parts[0]}.${parts[1]}"`;
    } else {
        return `"${parts[0]}"."${parts[1]}"`;
    }
}
