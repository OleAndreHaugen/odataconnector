let fieldCatalog = [];
let columns = [];

// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

const connection = modules.typeorm.getConnection();
const metadata = connection.getMetadata(connector.config.table);

metadata.ownColumns.forEach(function (column, i) {

    let field = {
        name: column.propertyName,
        type: column.type,
        enum: column.enum
    }

    columns.push(field);

});

for (let i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

    if (field.sel) {

        let fieldMeta = columns.find((f) => f.name === field.name);
        if (!fieldMeta) return;

        let usage = "BOTH";
        let type = "string";
        let items = [];

        // Type
        switch (field.type) {

            case "datetime":
                type = "timestamp";
                break;

            default:
                break;

        }

        // Items 
        if (fieldMeta.enum) {

            switch (field.name) {

                case "idpSource":
                    items.push({ key: "azure-bearer", text: "Azure AD" })
                    items.push({ key: "external", text: "External" })
                    items.push({ key: "ldap", text: "LDAP" })
                    items.push({ key: "local", text: "Local" })
                    items.push({ key: "jwt", text: "Java Web Token" })
                    items.push({ key: "oauth2", text: "oAuth 2.0" })
                    items.push({ key: "openid-connect", text: "Open ID Connect" })
                    items.push({ key: "sap", text: "SAP" })
                    items.push({ key: "saml", text: "SAML" })
                    break;

                case "actionType":
                    items.push({ key: "A", text: "Application" })
                    items.push({ key: "F", text: "Adaptive Application" })
                    items.push({ key: "T", text: "Tile Group" })
                    items.push({ key: "U", text: "URL" })
                    items.push({ key: "W", text: "Web Application" })
                    break;

                default:
                    fieldMeta.enum.forEach(function (value) {
                        items.push({ key: value, text: value })
                    })
                    break;

            }


        }

        fieldCatalog.push({
            name: field.name,
            label: field.label,
            type: type,
            usage: usage,
            items: items
        });

    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();
