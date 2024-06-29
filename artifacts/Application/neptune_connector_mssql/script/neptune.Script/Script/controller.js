const controller = {
    type: "mssql",
    selectedSystem: null,
    init: function () {
        jQuery.sap.require("sap.m.MessageBox");

        if (!cockpitUtils.isCockpit) {
            sap.m.MessageBox.confirm("Neptune MS SQL Server Connectors is only supported to run inside our Cockpit. Press OK and we will guide to to the right place.", {
                icon: sap.m.MessageBox.Icon.INFORMATION,
                title: "System Information",
                actions: [sap.m.MessageBox.Action.OK],
                initialFocus: "Ok",
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        location.href = location.origin + "/cockpit.html#afconnector-mssql";
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
            config: {
                fields: [],
            },
            type: controller.type,
        });

        tabDetailFields.setCount(0);

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
            }).then(
                function (res) {
                    sap.m.MessageToast.show("Connector Deleted");
                    controller.list();
                    oApp.setBusy(false);
                    oApp.back();
                },
                function (error) {
                    oApp.setBusy(false);
                }
            );
        }, "MS SQL Server Connector");
    },

    save: function () {
        // Check Required Fields
        if (!sap.n.Planet9.requiredFieldsCheck(cockpitUtils.requiredFields)) {
            return;
        }

        apiSave({
            data: modeloPageDetail.oData,
        }).then(function (req) {
            if (req.message) {
                sap.m.MessageToast.show(req.message);
            }

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

            if (modeloPageDetail.oData.config.fields && modeloPageDetail.oData.config.fields.length) {
                tabDetailFields.setCount(modeloPageDetail.oData.config.fields.length);
            } else {
                tabDetailFields.setCount(0);
            }

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

    openSchema: function () {
        if (!modeltabSchema.oData || !modeltabSchema.oData.length) toolSchemaUpdate.firePress();
        toolSchemaFilter.setValue();
        toolSchemaFilter.fireLiveChange();
        tabSchema.clearSelection();
        diaSchema.open();
    },

    openTables: function () {

        if (controller.selectedSystem !== modeloPageDetail.oData.systemid) {
            toolTablesUpdate.firePress();
        }

        toolTablesFilter.setValue();
        toolTablesFilter.fireLiveChange();
        tabTables.clearSelection();
        diaTables.open();
    },

    openEntitySet: function () {
        toolEntitySetsUpdate.firePress();
        toolEntitySetsFilter.setValue();
        toolEntitySetsFilter.fireLiveChange();
        tabEntitySets.clearSelection();

        diaEntitySets.open();
    },

    updateFields: async function () {
        apiGetFields({
            parameters: {
                dbid: modeloPageDetail.oData.systemid,
                table: modeloPageDetail.oData.config.table,
                isview: modeloPageDetail.oData.config.isview,
            },
        }).then(function (res) {
            if (res.error) {
                sap.m.MessageToast.show(res.error);
                return;
            }

            // Updated Fields
            for (let i = 0; i < res.length; i++) {
                const fieldDB = res[i];
                const fieldExist = ModelData.FindFirst(modeloPageDetail.oData.config.fields, "name", fieldDB.name);

                if (fieldExist) {
                    fieldExist.name = fieldDB.name;
                    fieldExist.description = fieldDB.description;
                    if (fieldDB.is_identity) fieldExist.is_identity = fieldDB.is_identity;
                } else {
                    ModelData.Add(modeloPageDetail.oData.config.fields, fieldDB);
                }
            }

            // Deleted Fields
            for (let i = 0; i < modeloPageDetail.oData.config.fields.length; i++) {
                const fieldExist = modeloPageDetail.oData.config.fields[i];
                const fieldDB = ModelData.FindFirst(res, "name", fieldExist.name);
                if (!fieldDB) fieldExist.deleteme = true;
            }

            ModelData.Delete(modeloPageDetail.oData.config.fields, "deleteme", true);
            modeloPageDetail.refresh(true);
        });
    },

    buildQuery: function () {
        formQueryFilter.removeAllContent();
        tabQuery.removeAllColumns();
        controller.fields = [];

        modeltabQuery.setData();
        modelpanQueryFilter.setData({});
        panQueryTable.setHeaderText("Result (0)");

        const columListItem = new sap.m.ColumnListItem();
        let sortColumns = [];

        modeloPageDetail.oData.config.fields.forEach(function (field) {
            if (field.sel) {
                const label = new sap.m.Label({ text: field.label ? field.label : field.name });
                const input = new sap.m.SearchField({
                    value: "{/" + field.name + "}",
                    search: function (oEvent) {
                        toolQueryRun.firePress();
                    },
                });

                formQueryFilter.addContent(label);
                formQueryFilter.addContent(input);

                const column = new sap.m.Column();
                column.setHeader(new sap.m.Label({ text: field.label ? field.label : field.name }));

                tabQuery.addColumn(column);

                columListItem.addCell(new sap.m.Text({ text: "{" + field.name + "}" }));

                sortColumns.push({ column: column, field: field.name });
            }
        });

        tabQuery.bindAggregation("items", { path: "/", template: columListItem, templateShareable: false });

        Pagination[tabQuery.sId] = null;

        // Enable Pagination
        Pagination.init({
            table: tabQuery,
            list: controller.runQuery,
            parentBar: oDetailFooter,
            sortColumns: sortColumns,
            sortField: modeloPageDetail.oData.config.fields[0].name,
            sortOrder: "ASC",
        });
    },

    runQuery: function () {
        panQueryOuter.setBusy(true);

        const fields = ModelData.Find(modeloPageDetail.oData.config.fields, "sel", true);

        const options = {
            data: {
                filter: modelpanQueryFilter.oData,
                fields: fields,
                _pagination: {
                    take: Pagination[tabQuery.sId].take,
                    skip: Pagination[tabQuery.sId].index * Pagination[tabQuery.sId].take,
                },
                sortField: Pagination[tabQuery.sId].sortField,
                sortOrder: Pagination[tabQuery.sId].sortOrder,
            },
            parameters: {
                id: modeloPageDetail.oData.id,
            },
        };

        apiQuery(options)
            .then(function (res) {
                if (res.message) {
                    sap.m.MessageToast.show(res.message);
                }

                modeltabQuery.setData(res.result);
                panQueryTable.setHeaderText("Result (" + res.count + ")");

                Pagination.handle(res, tabQuery.sId);

                panQueryOuter.setBusy(false);
            })
            .catch(function (res) {
                panQueryOuter.setBusy(false);
                console.log(res);
            });
    },
};

controller.init();
