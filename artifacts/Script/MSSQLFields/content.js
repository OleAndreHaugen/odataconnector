if (!req.query.dbid) {
    result.data = { error: "Please select database connection string" };
    return complete();
}

if (!req.query.table) {
    result.data = { error: "Please select database table" };
    return complete();
}

try {
    let query = `select col.name,
    col.object_id,
    typ.name as type,
    col.max_length,
    col.is_identity,
    prop.value as description
    from sys.columns as col    
    left join sys.tables as tab on tab.object_id = col.object_id
    left join sys.extended_properties as prop on prop.major_id = col.object_id and prop.minor_id = col.column_id and prop.name = 'MS_Description'
    left join sys.types as typ on typ.system_type_id = col.system_type_id and typ.user_type_id = col.user_type_id
    where tab.name = '${req.query.table}'
    order by name`;

    let res = await globals.Utils.MSSQLExec(req.query.dbid, query);

    if (res.error) {
        result.data = res;
        return complete();
    }

    if (!res.recordset.length) {
        query = `select col.name,
    col.object_id,
    typ.name as type,
    col.max_length,
    col.is_identity,
    prop.value as description
    from sys.columns as col    
    left join sys.views as tab on tab.object_id = col.object_id
    left join sys.extended_properties as prop on prop.major_id = col.object_id and prop.minor_id = col.column_id and prop.name = 'MS_Description'
    left join sys.types as typ on typ.system_type_id = col.system_type_id and typ.user_type_id = col.user_type_id
    where tab.name = '${req.query.table}'
    order by name`;

        res = await globals.Utils.MSSQLExec(req.query.dbid, query);
    }

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
