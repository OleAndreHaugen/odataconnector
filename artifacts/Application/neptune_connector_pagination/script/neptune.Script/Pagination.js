const Pagination = {
    init: function (options) {
        const tableId = options.table.sId;

        // Prevent double init
        if (Pagination[tableId]) return;

        Pagination[tableId] = {
            take: 10,
            index: 0,
            count: 0,
            list: options.list,
            sortColumns: options.sortColumns,
            sortField: options.sortField,
            sortOrder: options.sortOrder || "ASC",
        };

        // Enable Column Sorter
        if (options.sortColumns) Pagination.enableColumnSorting(options.table.sId);

        const toolPagination = new sap.m.Toolbar({
            width: "100%",
            design: "Transparent",
        }).addStyleClass("sapUiSizeCompact connectorToolbar");

        toolPagination.addContent(
            new sap.m.Text({
                textAlign: "Center",
                text: "Items per page",
            }).addStyleClass("sapUiHideOnPhone")
        );

        var toolPaginationShowItems = new sap.m.Select({
            width: "100px",
            selectedKey: "",
            change: function (oEvent) {
                Pagination[tableId].take = this.getSelectedKey();
                Pagination[tableId].index = 0;
                Pagination[tableId].list();
            },
        }).addStyleClass("sapUiHideOnPhone");

        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: "Default", key: Pagination[tableId].take || 5 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 5, key: 5 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 10, key: 10 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 15, key: 15 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 20, key: 20 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 30, key: 30 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 40, key: 40 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 50, key: 50 }));
        toolPaginationShowItems.addItem(new sap.ui.core.ListItem({ text: 100, key: 100 }));

        toolPagination.addContent(toolPaginationShowItems);
        toolPagination.addContent(new sap.m.ToolbarSpacer());

        toolPagination.addContent(
            new sap.m.Button("paginationFirst" + tableId, {
                icon: "sap-icon://fa-solid/angle-double-left",
                press: function (oEvent) {
                    Pagination[tableId].index = 0;
                    Pagination[tableId].list();
                },
            })
        );

        toolPagination.addContent(
            new sap.m.Button("paginationPrev" + tableId, {
                icon: "sap-icon://fa-solid/angle-left",
                press: function (oEvent) {
                    Pagination[tableId].index--;
                    Pagination[tableId].list();
                },
            })
        );

        const toolPaginationPages = new sap.m.SegmentedButton("paginationPages" + tableId, {
            selectionChange: function (oEvent) {
                Pagination[tableId].index = parseInt(this.getSelectedKey());
                Pagination[tableId].list();
            },
        });

        toolPagination.addContent(toolPaginationPages);

        const toolPaginationText = new sap.m.Text({
            visible: false,
            textAlign: "Center",
            text: "0/0",
        });

        toolPagination.addContent(toolPaginationText);

        toolPagination.addContent(
            new sap.m.Button("paginationNext" + tableId, {
                icon: "sap-icon://fa-solid/angle-right",
                press: function (oEvent) {
                    Pagination[tableId].index++;
                    Pagination[tableId].list();
                },
            })
        );

        toolPagination.addContent(
            new sap.m.Button("paginationLast" + tableId, {
                icon: "sap-icon://fa-solid/angle-double-right",
                press: function (oEvent) {
                    let maxIndex = Pagination[tableId].count / parseInt(Pagination[tableId].take);
                    maxIndex = Math.ceil(maxIndex);

                    Pagination[tableId].index = maxIndex - 1;
                    Pagination[tableId].list();
                },
            })
        );

        toolPagination.addContent(new sap.m.ToolbarSeparator());

        const toolPaginationTitle = new sap.m.ObjectNumber("paginationTitle" + tableId, {});

        toolPagination.addContent(toolPaginationTitle);

        if (options.parentBar) {
            options.parentBar.addContentLeft(toolPagination);
        } else {
            options.table.setInfoToolbar(toolPagination);
        }
    },

    handle: function (response, tableId) {
        Pagination[tableId].count = response.count;

        let maxIndex = Pagination[tableId].count / Pagination[tableId].take;
        maxIndex = Math.ceil(maxIndex);

        if (Pagination[tableId].count <= Pagination[tableId].take) maxIndex = 1;

        let toolPaginationFirst = sap.ui.getCore().byId("paginationFirst" + tableId);
        let toolPaginationPrev = sap.ui.getCore().byId("paginationPrev" + tableId);
        let toolPaginationNext = sap.ui.getCore().byId("paginationNext" + tableId);
        let toolPaginationLast = sap.ui.getCore().byId("paginationLast" + tableId);
        let toolPaginationPages = sap.ui.getCore().byId("paginationPages" + tableId);
        let toolPaginationTitle = sap.ui.getCore().byId("paginationTitle" + tableId);

        toolPaginationFirst.setEnabled(true);
        toolPaginationPrev.setEnabled(true);
        toolPaginationNext.setEnabled(true);
        toolPaginationLast.setEnabled(true);

        if (Pagination[tableId].index < 0) Pagination[tableId].index = 0;

        if (Pagination[tableId].index === 0) {
            toolPaginationFirst.setEnabled(false);
            toolPaginationPrev.setEnabled(false);
        }

        if (Pagination[tableId].index + 1 >= maxIndex) {
            toolPaginationNext.setEnabled(false);
            toolPaginationLast.setEnabled(false);
        }

        toolPaginationPages.destroyItems();

        let numItems = 0;
        let maxItems = 6;
        let startItem = Pagination[tableId].index - maxItems / 2;

        if (startItem < 0) startItem = 0;

        for (i = startItem; i < maxIndex; i++) {
            if (numItems <= maxItems) toolPaginationPages.addItem(new sap.m.SegmentedButtonItem({ text: i + 1, key: i }));
            numItems++;
        }

        toolPaginationPages.setSelectedKey(Pagination[tableId].index);
        toolPaginationTitle.setNumber(Pagination[tableId].index + 1 + "/" + maxIndex);
    },

    enableColumnSorting: function (tableId) {
        const columns = Pagination[tableId].sortColumns;

        // Set Default Sort Field/Order
        const columnInit = ModelData.FindFirst(columns,"field",Pagination[tableId].sortField);

        if (columnInit) {
            columnInit.column.setSortIndicator(Pagination[tableId].sortOrder === "ASC"? "Ascending":"Descending");
        }

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i].column;
            const field = columns[i].field;

            const _column_delegate = {
                onclick: function (e) {
                    const sortIndicatorOrder = column.getSortIndicator();

                    // Clear All
                    Pagination[tableId].sortColumns.forEach(function (sortColumn) {
                        sortColumn.column.setSortIndicator("None");
                    });

                    if (sortIndicatorOrder === "Ascending") {
                        column.setSortIndicator("Descending");
                        sortModelOrder = true;
                    } else {
                        column.setSortIndicator("Ascending");
                        sortModelOrder = false;
                    }

                    Pagination[tableId].sortOrder = column.getSortIndicator() === "Ascending" ? "ASC":"DESC";
                    Pagination[tableId].sortField = field;
                    Pagination[tableId].list();
                },
            };

            column.addEventDelegate(_column_delegate);

            column.exit = function () {
                column.removeEventDelegate(_column_delegate);
            };

            column.setStyleClass("nepMTableSortCell");
        }
    },
};
