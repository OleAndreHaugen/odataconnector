// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

let selectedFields = [];

const client = await globals.Utils.HANAConnect(connector.systemid);

if (client.error) {
    result.data = client;
    return complete();
}

// Get all selected fields
await getFields();

try {

    // Process Method
    switch (req.query.method) {

        case "Delete":
            processDelete();
            break;

        case "Save":
            processSave();
            break;

        case "Get":
            processGet();
            break;

        default:
            processList();
            break;
    }

} catch (e) {

    result.data = {
        status: "ERROR",
        message: e
    }

    complete();

}

async function processList() {

    let sep = "";
    let fields = '';
    let where = '';
    let statement;

    // Where 
    const bodyFields = Object.keys(req.body);

    bodyFields.forEach(function (fieldName) {

        const fieldValue = req.body[fieldName];
        if (!fieldValue) return;

        const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
        if (!fieldSel) return;

        switch (fieldSel.type) {

            case "CheckBox":
            case "Switch":
            case "SingleSelect":
            case "SingleSelectLookup":
            case "SingleSelectScript":
                where += sep + `"${fieldName}" = '${fieldValue}'`;
                break;

            case "MultiSelect":
            case "MultiSelectLookup":
            case "MultiSelectScript":
                where += sep + `"${fieldName}" IN (${fieldValue})`;
                break;

            default:
                where += sep + `"${fieldName}" LIKE '%${fieldValue}'`;
                sep = " and ";
                break;

        }

    });

    if (where) where = " where " + where;

    // Count
    const resCount = await globals.Utils.HANAExec(client, `select count(*) from "${connector.config.schema}"."${connector.config.table}" ${where}`);

    if (resCount.error) {
        result.data = resCount;
        return complete();
    }

    // Selected Fields
    sep = "";
    if (req.body._settings.fieldsRun) {
        req.body._settings.fieldsRun.forEach(function (field) {
            fields += sep + '"' + field.name + '"';
            sep = ",";
        });
    } else {
        return { error: "No fields to display in table" };
    }

    // SQL Statement
    statement = `select ${fields} from "${connector.config.schema}"."${connector.config.table}" ${where}`;

    // Sorting
    if (req.body._order) {

        const orderField = Object.keys(req.body._order)[0];

        if (orderField) {
            let orderType = req.body._order[orderField].toLowerCase();
            if (orderType === "asc") orderType = "";

            statement += ` order by "${orderField}" ${orderType}`;
        }

    }

    // Pagination
    if (req.body._pagination) {
        statement += ` limit ${req.body._pagination.take} offset ${req.body._pagination.skip}`
    }

    // Query Table 
    const resData = await globals.Utils.HANAExec(client, statement);

    if (resData.error) {
        result.data = {
            status: "ERROR",
            message: resData.error
        }
        return complete();
    } else {
        result.data = {
            count: resCount[0]["COUNT(*)"],
            result: resData,
            debug: statement,
            where: where
        }
    }

    complete();

}

async function processSave() {

    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Save not supported."
        }
    }

    complete();
}

async function processGet() {


    let sep = "";
    let fields = '';
    let where = '';
    let statement;

    // Where 
    req.body._keyField.forEach(function (keyField) {
        where += sep + `"${keyField.fieldName}" = '${req.body[keyField.fieldName]}'`;
        sep = " and ";
    });

    if (where) where = " where " + where;

    // Selected Fields
    sep = "";
    if (req.body._settings.fieldsSel) {
        req.body._settings.fieldsSel.forEach(function (field) {
            fields += sep + '"' + field.name + '"';
            sep = ",";
        });
    }

    // SQL Statement
    statement = `select ${fields} from "${connector.config.schema}"."${connector.config.table}" ${where}`;

    // Query Table 
    const resData = await globals.Utils.HANAExec(client, statement);

    if (resData.error) {
        result.data = {
            status: "ERROR",
            message: resData.error,
            debug: statement
        }
    } else {
        result.data = resData;
    }

    complete();
}

async function processDelete() {

    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Delete not supported."
        }
    }

    complete();
}

async function getFields() {

    connector.config.fields.forEach(async function (field) {

        if (field.sel) {
            selectedFields.push({
                name: field.name,
                label: field.label,
                type: field.type,
            });
        }

    })

}