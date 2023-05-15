let fieldCatalog = [];

const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

for (let i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

    if (field.sel) {

        let type;

        switch (field.internal_type) {

            case "glide_date_time":
            case "glide_date":
                type = "timestamp";
                break;

            default:
                type = field.internal_type;
                break;

        }

        let element = {
            type: type,
            name: field.name,
            label: field.label,
            usage: "BOTH",
        }

        if (field.items) {
            element.items = [];
            field.items.forEach(function (item) {

                if (item.sel === false) return;

                element.items.push({
                    key: item.value,
                    text: item.label ? item.label : item.value
                })

            })
        }

        fieldCatalog.push(element)
    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();