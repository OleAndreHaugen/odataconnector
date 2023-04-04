const controller = {
    type: "odata",
    init: function () {
        jQuery.sap.require("sap.m.MessageBox");

        if (!cockpitUtils.isCockpit) {
            sap.m.MessageBox.confirm("Neptune OData Connectors is only supported to run inside our Cockpit. Press OK and we will guide to to the right place.", {
                icon: sap.m.MessageBox.Icon.INFORMATION,
                title: "System Information",
                actions: [sap.m.MessageBox.Action.OK],
                initialFocus: "Ok",
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        location.href = location.origin + "/cockpit.html#afconnector-odata";
                    }
                },
            });
        }
    },

    new: function () {
        modeloPageDetail.setData({
            name: "",
            description: "",
            metadata: {},
            config: {},
            type: controller.type,
        });

        tabDetail.setSelectedItem(tabDetailInfo);
        cockpitUtils.toggleCreate();
        cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        oApp.to(oPageDetail);
    },

    delete: function () {
        sap.n.Planet9.objectDelete(function () {
            oApp.setBusy(true);
            sap.n.Planet9.setToolbarButton(false);

            apiDelete({
                parameters: {
                    id: modeloPageDetail.oData.id,
                },
            }).then(function (res) {
                sap.m.MessageToast.show("Connector Deleted");
                controller.list();
                oApp.setBusy(false);
                oApp.back();
            });
        }, "OData Connector");
    },

    save: function () {
        // Check Required Fields
        if (!sap.n.Planet9.requiredFieldsCheck(cockpitUtils.requiredFields)) {
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
        apiList({
            parameters: {
                type: controller.type,
            },
        }).then(function (res) {
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
                systemid: modeloPageDetail.oData.systemid,
                service: modeloPageDetail.oData.config.service,
                entitySet: modeloPageDetail.oData.config.entitySet,
                source: modeloPageDetail.oData.config.source,
            },
        }).then(function (res) {
            if (res.error) {
                sap.m.MessageToast.show(res.error);
            } else {
                modeloPageDetail.oData.metadata = res.metadata;
                modeloPageDetail.oData.config.fields = res.fields;

                for (let i = 0; i < selected.length; i++) {
                    const sel = selected[i];
                    const field = ModelData.FindFirst(modeloPageDetail.oData.config.fields, "name", sel.name);
                    if (field) field.sel = true;
                }

                modeloPageDetail.refresh(true);
            }
        });
    },
};

controller.init();
