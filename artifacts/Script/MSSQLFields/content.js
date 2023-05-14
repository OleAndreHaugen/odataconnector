if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

if (!req.query.table_object_id) {
    result.data = { error: "Please select database table" };
    return complete();
}

try {
    const query =
    `select col.name,
    col.object_id,
    col.system_type_id,
    prop.value as description
    from sys.columns as col    
    left join sys.extended_properties as prop on prop.major_id = col.object_id and prop.minor_id = col.column_id and prop.name = 'MS_Description'
    where object_id = '${req.query.table_object_id}'
    order by name`;

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
