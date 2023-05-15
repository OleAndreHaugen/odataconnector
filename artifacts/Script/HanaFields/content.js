if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

if (!req.query.schema) {
    result.data = { error: "Please select database schema" };
    return complete();
}

if (!req.query.table) {
    result.data = { error: "Please select database table" };
    return complete();
}

try {

    let resFields = [];

    const client = await globals.Utils.HANAConnect(req.query.dbid);

    if (client.error) {
        result.data = client;
        return complete();
    }

    let res;

    if (req.query.isview) {
        res = await globals.Utils.HANAExec(client, `select COLUMN_NAME,DATA_TYPE_NAME,COMMENTS from view_columns where schema_name = '${req.query.schema}' and view_name = '${req.query.table}'`);
    } else {
        res = await globals.Utils.HANAExec(client, `select COLUMN_NAME,DATA_TYPE_NAME,COMMENTS from table_columns where schema_name = '${req.query.schema}' and table_name = '${req.query.table}'`);
    }

    if (res.error) {
        result.data = res;
        return complete();
    }

    for (let i = 0; i < res.length; i++) {
        const field = res[i];
        resFields.push({
            name: field.COLUMN_NAME,
            label: field.COLUMN_NAME, //UpperCaseArray(field.COLUMN_NAME),
            type: field.DATA_TYPE_NAME,
            description:field.COMMENTS
        })
    }

    result.data = resFields.sort(globals.Utils.SortBy("name"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

function UpperCaseArray(input) {

    let result = input.split("_");
    let label = "";
    let sep = "";

    result.forEach(function (part) {
        label += sep + part.charAt(0).toUpperCase() + part.slice(1)
        sep = " ";
    })

    return label;
}