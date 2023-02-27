let fieldCatalog = [];

const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

for (i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

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


    if (field.sel) {
        fieldCatalog.push({
            type: type,
            name: field.name,
            label: field.label,
            usage: "BOTH",
        })
    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();