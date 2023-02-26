const SystemId = req.query.systemid;
const SystemUrl = "/api/now/table/sys_db_object?sysparm_fields=label,name";

let tables = [];

// Check for system ID
if (!SystemId) {
    result.data = { error: "Please select system" };
    return complete();
}

try {

    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

    if (res.error) {
        result.data = res;
        return complete();
    }

    for (i = 0; i < res.data.result.length; i++) {
        const table = res.data.result[i];
        tables.push(table);
    }

    result.data = tables.sort(globals.Utils.SortBy("name"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
