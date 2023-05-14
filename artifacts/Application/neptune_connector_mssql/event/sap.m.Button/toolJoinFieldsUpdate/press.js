apiGetFields({
    parameters: {
        dbid: modeloPageDetail.oData.systemid,
        table: controller.fieldOpenData.joinTable,
        isview: controller.fieldOpenData.joinIsView,
    },
}).then(function (res) {
    // Selected Fields
    const selected = ModelData.Find(tabJoinFields, "sel", true);
    const keys = ModelData.Find(tabJoinFields, "key", true);

    for (let i = 0; i < res.length; i++) {
        const field = res[i];

        // Selected
        const fieldSelected = ModelData.FindFirst(selected, "name", field.name);
        if (fieldSelected) field.sel = true;

        // Key
        const fieldKey = ModelData.FindFirst(keys, "name", field.name);
        if (fieldKey) field.key = true;
    }

    modeltabJoinFields.setData(res);
});
