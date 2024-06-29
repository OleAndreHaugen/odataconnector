diaTables.setBusy(true);

apiGetTables({
    parameters: {
        dbid: modeloPageDetail.oData.systemid,
        schema_id: modeloPageDetail.oData.config.schema_id,
    },
}).then(
    function (res) {
        diaTables.setBusy(false);

        controller.selectedSystem = modeloPageDetail.oData.systemid;

        if (res.error) {
            sap.m.MessageToast.show(res.error);
        } else {
            modeltabTables.setData(res);
            modeltabTables.refresh();
            diaTables.setTitle("MS SQL Server Tables (" + res.length + ")");
        }
    },
    function (error) {
        diaTables.setBusy(false);
    }
);
