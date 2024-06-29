if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

if (!req.query.table) {
    result.data = { error: "Please select database table" };
    return complete();
}

const skip = req.query?.skip || 0;

try {
    let query = `select * from ${req.query.table} order by ${req.query.orderBy} offset ${skip} rows fetch next ${req.query.take} rows only`;
    let res = await globals.Utils.MSSQLExec(req.query.dbid, query);
    
    result.data = res.recordset;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
