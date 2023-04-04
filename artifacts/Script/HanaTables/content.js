if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

if (!req.query.schema) {
    result.data = { error: "Please select database schema" };
    return complete();
}

try {

    const client = await globals.Utils.HANAConnect(req.query.dbid);

    if (client.error) {
        result.data = client;
        return complete();
    }

    const resTables = await globals.Utils.HANAExec(client, `select TABLE_NAME,CREATE_TIME,COMMENTS from TABLES where schema_name = '${req.query.schema}'`);
    const resViews = await globals.Utils.HANAExec(client, `select VIEW_NAME,CREATE_TIME,COMMENTS from VIEWS where schema_name = '${req.query.schema}'`);

    if (res.error) {
        result.data = res;
        return complete();
    }

    let tables = resTables;

    resViews.forEach(function (view) {
        tables.push({
            TABLE_NAME: view.VIEW_NAME,
            CREATE_TIME: view.CREATE_TIME,
            COMMENTS: view.COMMENTS,
            IS_VIEW: true
        })
    })

    result.data = tables.sort(globals.Utils.SortBy("TABLE_NAME"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

