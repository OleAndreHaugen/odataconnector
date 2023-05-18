const SystemId = req.query.systemid;
const SystemUrl =
    "/api/now/table/" +
    req.query.table +
    "?sysparm_display_value=true&sysparm_limit=1000&sysparm_fields=sys_id," +
    req.query.displayfield;

let values = [];

// Get Dictionary Fields
const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

if (res.error) {
    result.data = res;
    return complete();
}

if (res.message) {
    result.data = { error: res.message };
    return complete();
}

res.data.result.forEach(function (row) {
    if (row[req.query.displayfield] && typeof row[req.query.displayfield] === "object") {
        row[req.query.displayfield] = row[req.query.displayfield].display_value;
    }
});

result.data = res.data.result.sort(globals.Utils.SortBy(req.query.displayfield));

complete();
