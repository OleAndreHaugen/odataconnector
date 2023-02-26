let fields = [];

try {

    const connection = modules.typeorm.getConnection();
    const metadata = connection.getMetadata(req.query.table);

    metadata.ownColumns.forEach(function (column, i) {

        let field = {
            name: column.propertyName,
            type: column.type,
        }

        switch (column.propertyName) {
            case "changedBy":
                field.label = "Updated By"
                break;

            default:
                field.label = UpperCaseArray(column.propertyName);
                break;
        }

        switch (column.propertyName) {
            case "password":
            case "certificates":
                break;

            default:
                fields.push(field);
                break;
        }

    });

    result.data = fields.sort(globals.Utils.SortBy("label"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}


function UpperCaseArray(input) {
    input = input.charAt(0).toUpperCase() + input.slice(1);
    let result = input.replace(/([A-Z]+)/g, ",$1").replace(/^,/, "").split(",");
    let label = "";
    let sep = "";

    result.forEach(function (part) {
        label += sep + part;
        sep = " ";
    })

    return label;
}
