diaTables.setBusy(true);

apiGetTables({
    parameters: {
        dbid: modeloPageDetail.oData.systemid,
        schema: modeloPageDetail.oData.config.schema,
    },
}).then(function (res) {
    diaTables.setBusy(false);

    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabTables.setData(res);
        diaTables.setTitle("HANA DB Tables (" + res.length + ")");
    }
});
