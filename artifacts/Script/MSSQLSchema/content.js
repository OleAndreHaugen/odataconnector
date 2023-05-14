if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

try {
    const query = `select * from sys.schemas order by name`;
    const res = await globals.Utils.MSSQLExec(req.query.dbid, query);

    if (res.error) {
        result.data = res;
        return complete();
    }

    result.data = res.recordset;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
