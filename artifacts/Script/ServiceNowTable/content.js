const SystemId = req.query.systemid;
const SystemUrl = "/api/now/table/sys_dictionary?sysparm_query=name=" + req.query.table;

// active

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

    result.data = res.data.result.sort(globals.Utils.SortBy("column_label"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}