if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

try {

    const client = await globals.Utils.HANAConnect(req.query.dbid);

    if (client.error) {
        result.data = client;
        return complete();
    }

    const res = await globals.Utils.HANAExec(client, `select * from SCHEMAS`);

    if (res.error) {
        result.data = res;
        return complete();
    }

    result.data = res.sort(globals.Utils.SortBy("SCHEMA_NAME"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

