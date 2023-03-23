if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

try {

    const client = await globals.Utils.HANAConnect(req.query.dbid);

    console.log("After client");

    if (client.error) {
        result.data = client.error;
        return complete();
    }

    const schemas = await globals.Utils.HANAExec(client, `select * from SCHEMAS`);

    result.data = schemas.sort(globals.Utils.SortBy("SCHEMA_NAME"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

