const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

const SystemId = connector.systemid;
const SystemUrl = "/api/now/table/" + connector.config.table + "?sysparm_display_value=true";

// Handle Method
switch (req.query.method) {

    case "Save":
        await save(req);
        break;

    default:
        await processList(req);
        break;

}


async function processList() {

    let queryUrl = SystemUrl;
    let queryFields = "";
    let queryFilter = "";
    let whereSep = "";
    let sep = "";


    // API Query - Select
    if (req.body._settings.fieldsRun) {
        req.body._settings.fieldsRun.forEach(function (field) {
            queryFields += sep + field.name;
            sep = ",";
        });
    }

    // API Query - Filter
    const bodyFields = Object.keys(req.body);

    bodyFields.forEach(function (fieldName) {

        const fieldValue = req.body[fieldName];
        if (!fieldValue) return;

        const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
        if (!fieldSel) return;

        switch (fieldSel.type) {

            case "CheckBox":
            case "Switch":
                queryFilter += whereSep + fieldName + "=" + fieldValue;
                break;

            case "DateRange":
                queryFilter += whereSep + fieldName + ">=" + fieldValue;
                whereSep = " and ";
                queryFilter += whereSep + fieldName + "<=" + req.body[fieldName + "_end"];
                break;

            case "SingleSelect":
            case "SingleSelectLookup":
            case "SingleSelectScript":
                queryFilter += whereSep + fieldName + "=" + fieldValue;
                break;

            case "MultiSelect":
            case "MultiSelectLookup":
            case "MultiSelectScript":
                multiFilter = "";
                sep = "";

                fieldValue.forEach(function (value) {
                    multiFilter += sep + fieldValue;
                    sep = ",";
                });

                queryFilter += whereSep + fieldName + "IN" + multiFilter;
                break;

            default:
                if (fieldSel.selEqual) {
                    queryFilter += whereSep + fieldName + "=" + fieldValue;
                } else {
                    queryFilter += whereSep + fieldName + "LIKE" + fieldValue;
                }
                break;

        }

        whereSep = "^";

    });


    // API Query - Pagination
    if (req.body._pagination) {
        queryUrl += "&sysparm_limit=" + req.body._pagination.take;
        queryUrl += "&sysparm_offset=" + req.body._pagination.skip;
    }

    // // API Query - Order
    if (req.body._order) {

        const orderField = Object.keys(req.body._order)[0];

        if (orderField) {

            const orderType = req.body._order[orderField];

            if (orderType === "ASC") {
                queryFilter += whereSep + "ORDERBY" + orderField;
            } else {
                queryFilter += whereSep + "ORDERBYDESC" + orderField;
            }

        }

    }

    if (queryFilter) queryUrl += "&sysparm_query=" + queryFilter;
    if (queryFields) queryUrl += "&sysparm_fields=" + queryFields;

    const res = await globals.Utils.RequestHandler(queryUrl, SystemId, "json");

    const count = res.headers.get("X-Total-Count");

    // Format Result Data
    if (res.data && res.data.result && res.data.result.length) {

        // Merge LookupFields from SalesForce
        let fieldCatalog;

        if (req.query.method == "Get") {
            fieldCatalog = req.body._settings.fieldsSel;
        } else {
            fieldCatalog = req.body._settings.fieldsRun;
        }

        res.data.result.forEach(function (row) {

            // Format Data
            fieldCatalog.forEach(function (field) {

                if (row[field.name] && typeof row[field.name] === "object") {
                    // const displayValue = row[field.name].display_value;
                    row[field.name] = row[field.name].display_value;

                }
            });

        })
    }

    result.data = {
        count: count,
        result: res.data.result,
        debug: {
            url: queryUrl,
        }
    }

    complete();

}