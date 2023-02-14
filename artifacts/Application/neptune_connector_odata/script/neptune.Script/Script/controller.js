const controller = {
    init: function () {},

    new: function () {
        modeloPageDetail.setData({
            name: "",
            description: "",
            metadata: {},
            config: {},
        });

        tabDetail.setSelectedItem(tabDetailInfo);
        cockpitUtils.toggleCreate();
        cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        oApp.to(oPageDetail);
    },

    save: function () {
        // Check Required Fields
        if (cockpitUtils.isCockpit && !sap.n.Planet9.requiredFieldsCheck(cockpitUtils.requiredFields)) {
            return;
        }

        apiSave({
            data: modeloPageDetail.oData,
        }).then(function (req) {
            sap.m.MessageToast.show("Connector Saved");
            modeloPageDetail.oData.id = req.id;
            modeloPageDetail.oData.updatedAt = req.updatedAt;
            modeloPageDetail.oData.updatedBy = req.updatedBy;
            modeloPageDetail.oData.createdAt = req.createdAt || req.updatedAt;
            modeloPageDetail.oData.createdBy = req.createdBy;
            modeloPageDetail.refresh();
            controller.list();

            cockpitUtils.dataSaved = modeloPageDetail.getJSON();
            cockpitUtils.toggleEdit(true);
        });
    },

    get: function (id, editable) {
        apiGet({
            parameters: {
                id: id,
            },
        }).then(function (req) {
            modeloPageDetail.setData(req);

            if (oApp.getCurrentPage() === oPageStart) {
                tabDetail.setSelectedItem(tabDetailInfo);
            }

            toolFieldsFilter.setValue();
            toolFieldsFilter.fireLiveChange();

            oApp.to(oPageDetail);

            cockpitUtils.toggleEdit(editable);
            cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        });
    },

    list: function () {
        apiList().then(function (res) {
            modelappData.setData(res);
        });
    },

    openServices: function () {
        toolServicesUpdate.firePress();
        toolServicesFilter.setValue();
        toolServicesFilter.fireLiveChange();
        tabServices.clearSelection();

        diaServices.open();
    },

    openEntitySet: function () {
        toolEntitySetsUpdate.firePress();
        toolEntitySetsFilter.setValue();
        toolEntitySetsFilter.fireLiveChange();
        tabEntitySets.clearSelection();

        diaEntitySets.open();
    },

    updateFields: function () {
        let selected = [];

        if (modeloPageDetail.oData && modeloPageDetail.oData.config && modeloPageDetail.oData.config.fields) {
            selected = ModelData.Find(modeloPageDetail.oData.config.fields, "sel", true);
        }

        apiGetEntitySetFields({
            parameters: {
                service: modeloPageDetail.oData.config.service,
                entitySet: modeloPageDetail.oData.config.entitySet,
                systemid: modeloPageDetail.oData.systemid,
            },
        }).then(function (res) {
            modeloPageDetail.oData.metadata = res.metadata;
            modeloPageDetail.oData.config.fields = res.fields;

            for (let i = 0; i < selected.length; i++) {
                const sel = selected[i];
                const field = ModelData.FindFirst(modeloPageDetail.oData.config.fields, "name", sel.name);
                if (field) field.sel = true;
            }

            modeloPageDetail.refresh(true);
        });
    },
};

controller.init();
