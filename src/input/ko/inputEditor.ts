import * as ko from "knockout";
import * as mapping from "knockout-mapping";
import template from "./inputEditor.html";
import { IViewManager } from "@paperbits/common/ui";
import { IWidgetEditor } from "@paperbits/common/widgets";
import { Component } from "@paperbits/core/ko/component";
import { InputModel, InputType, OptionItem } from "../inputModel";
import { InputProperty } from "../inputProperty";

interface EditorSection {
    sectionName: string;
    editors: KnockoutObservableArray<EditorItem>;
    options?: KnockoutObservableArray<OptionItem>;
}

interface EditorItem {
    propertyLabel: string;
    propertyType: InputType;
    propertyName: string;
    propertyValue: KnockoutObservable<any>;
    propertyOptions?: { label: string, value: any }[];
}
@Component({
    selector: "input-editor",
    template: template,
    injectable: "inputEditor"
})
export class InputEditor implements IWidgetEditor {
    private model: InputModel;
    private applyChangesCallback: () => void;
    public controlType: KnockoutObservable<string>;
    public editorSections: KnockoutObservableArray<EditorSection>;
    public optionsSection: EditorSection;

    public showOptions: KnockoutObservable<boolean>;
    public itemNameToAdd: KnockoutObservable<string>;
    public itemValueToAdd: KnockoutObservable<string>;
    public selectedItems: KnockoutObservableArray<string>;

    private sectionPropertyMap: {
        [key: string]: { name: string, label: string, inputType: InputType, options?: { label: string, value: any }[] }
    } = {
            inputName: { name: "Main", label: "Name", inputType: "text" },
            placeholderText: { name: "Settings", label: "Placeholder text", inputType: "text" },
            help: { name: "Settings", label: "Help text", inputType: "text" },
            textValue: { name: "Settings", label: "Default text", inputType: "text" },
            inputValue: { name: "Settings", label: "Control value", inputType: "text" },
            isInline: { name: "Settings", label: "Is inline", inputType: "checkbox" },
            maxLength: { name: "Settings", label: "Max number of characters allowed", inputType: "number" },
            minValue: { name: "Settings", label: "Minimum value", inputType: "number" },
            maxValue: { name: "Settings", label: "Maximum value", inputType: "number" },
            sizeValue: { name: "Settings", label: "Size value", inputType: "number" },
            stepValue: { name: "Settings", label: "Step value", inputType: "number" },
            isChecked: { name: "Settings", label: "Is checked", inputType: "checkbox" },
            patternRegexp: { name: "Settings", label: "Pattern", inputType: "text" },
            accept: { name: "Settings", label: "Accept value", inputType: "text" },
            colsCount: { name: "Settings", label: "Visible width of characters", inputType: "number" },
            rowsCount: { name: "Settings", label: "Visible number of lines", inputType: "number" },
            isRequired: { name: "Settings", label: "Is required", inputType: "checkbox" },
            isReadonly: { name: "Miscellaneous", label: "Is read-only", inputType: "checkbox" },
            isDisabled: { name: "Miscellaneous", label: "Is disabled", inputType: "checkbox" },
            showLabel: { name: "Settings", label: "", inputType: "radio", options: [{ label: "None", value: "none" }, { label: "Before", value: "before" }, { label: "After", value: "after" }] },
            labelText: { name: "Settings", label: "Label text", inputType: "text" },
        };

    private itemMapping = {
        copy: ["propertyName"]
    };

    constructor(private viewManager: IViewManager) {
        this.controlType = ko.observable<string>();
        this.showOptions = ko.observable(false);
        this.itemNameToAdd = ko.observable("");
        this.itemValueToAdd = ko.observable("");
        this.selectedItems = ko.observableArray([]);

        this.optionsSection = { sectionName: "Options", editors: ko.observableArray<EditorItem>(), options: ko.observableArray([]) };
        const sections: EditorSection[] = [
            { sectionName: "Main", editors: ko.observableArray<EditorItem>() },
            { sectionName: "Label", editors: ko.observableArray<EditorItem>() },
            this.optionsSection,
            { sectionName: "Settings", editors: ko.observableArray<EditorItem>() },
            { sectionName: "Miscellaneous", editors: ko.observableArray<EditorItem>() }
        ];
        this.editorSections = ko.observableArray<EditorSection>();
        this.editorSections(sections);

        this.onChange = this.onChange.bind(this);
        this.onOptionsChange = this.onOptionsChange.bind(this);
        this.upItem = this.upItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.downItem = this.downItem.bind(this);
        this.deleteItem = this.deleteItem.bind(this);
        this.setSelectedItemDefault = this.setSelectedItemDefault.bind(this);
        this.copyNameToValue = this.copyNameToValue.bind(this);
        this.itemNameToAdd.subscribe(this.copyNameToValue, null, "beforeChange");
    }

    public setWidgetModel(model: InputModel, applyChangesCallback?: () => void): void {
        if (!this.model || (this.model && this.model.inputType !== model.inputType)) {
            this.controlType(model.inputType);
            this.adjustControlsMetadata(model.inputType);
        }
        this.model = model;
        this.applyChangesCallback = applyChangesCallback;

        if (this.model.inputProperties.length > 0) {
            if (this.model.options) {
                this.optionsSection.options(this.model.options);
                this.optionsSection.options.subscribe(this.onOptionsChange);
                this.showOptions(true);
            } else {
                this.showOptions(false);
            }
            const defaultSection = this.editorSections()[this.editorSections().length - 1];

            for (const inputProperty of this.model.inputProperties) {
                const sectionMetadata = this.sectionPropertyMap[inputProperty.propertyName];
                const edit: EditorItem = mapping.fromJS(inputProperty, this.itemMapping);

                edit.propertyLabel = sectionMetadata.label;
                edit.propertyType = sectionMetadata.inputType;
                edit.propertyOptions = sectionMetadata.options || [];
                edit.propertyValue.extend({ rateLimit: { timeout: 500, method: "notifyWhenChangesStop" } });
                edit.propertyValue.subscribe(this.onChange);

                if (!sectionMetadata) {
                    defaultSection.editors.push(edit);
                }
                else {
                    const section = this.editorSections().find((item) => item.sectionName === sectionMetadata.name);
                    section.editors.push(edit);
                }
            }
        }
    }

    private adjustControlsMetadata(inputType: InputType) {
        switch (inputType) {
            case "date":
                this.sectionPropertyMap["inputValue"].inputType = "date";
                this.sectionPropertyMap["minValue"].inputType = "date";
                this.sectionPropertyMap["maxValue"].inputType = "date";
                break;
            case "time":
                this.sectionPropertyMap["inputValue"].inputType = "time";
                this.sectionPropertyMap["minValue"].inputType = "time";
                this.sectionPropertyMap["maxValue"].inputType = "time";
                break;
            default:
                this.sectionPropertyMap["inputValue"].inputType = "text";
                this.sectionPropertyMap["minValue"].inputType = "number";
                this.sectionPropertyMap["maxValue"].inputType = "number";
                break;
        }
    }

    private onChange() {
        const currentEdits: InputProperty[] = [];
        for (let i = 0; i < this.editorSections().length; i++) {
            const section = this.editorSections()[i];
            currentEdits.push(...mapping.toJS(section.editors));
        }
        this.model.inputProperties = currentEdits;
        this.applyChangesCallback();
    }

    private onOptionsChange() {
        this.model.options = mapping.toJS(this.optionsSection.options);
        this.applyChangesCallback();
    }

    public closeEditor(): void {
        this.viewManager.closeWidgetEditor();
    }

    public addItem() {
        if (this.itemNameToAdd() !== "" && this.itemValueToAdd() !== "" &&
            !this.optionsSection.options().find((item) => item.itemValue === this.itemValueToAdd())) {
            this.optionsSection.options.push({ itemName: this.itemNameToAdd(), itemValue: this.itemValueToAdd() });
            this.applyChangesCallback();
        }
        this.itemNameToAdd("");
        this.itemValueToAdd("");
    }

    public upItem() {
        const selectedFirstValue = this.selectedItems()[0];
        const selectedLastValue = this.selectedItems()[this.selectedItems().length - 1];
        const posFirst = this.optionsSection.options().findIndex(item => item.itemValue === selectedFirstValue);
        const posLast = this.optionsSection.options().findIndex(item => item.itemValue === selectedLastValue);
        if (posFirst > 0) {
            const moveItem = this.optionsSection.options.splice(posFirst - 1, 1);
            this.optionsSection.options.splice(posLast, 0, moveItem[0]);
            this.applyChangesCallback();
        }
    }

    public downItem() {
        const selectedFirstValue = this.selectedItems()[0];
        const selectedLastValue = this.selectedItems()[this.selectedItems().length - 1];
        const posFirst = this.optionsSection.options().findIndex(item => item.itemValue === selectedFirstValue);
        const posLast = this.optionsSection.options().findIndex(item => item.itemValue === selectedLastValue);
        if (posLast < this.optionsSection.options().length - 1) {
            const moveItem = this.optionsSection.options.splice(posLast + 1, 1);
            this.optionsSection.options.splice(posFirst, 0, moveItem[0]);
            this.applyChangesCallback();
        }
    }

    public deleteItem() {
        if (this.selectedItems().length > 0) {
            this.optionsSection.options.remove((item) => this.selectedItems().findIndex(selectedValue => selectedValue === item.itemValue) !== -1);
            this.applyChangesCallback();
            this.selectedItems([]);
        }
    }

    public setSelectedItemDefault() {
        if (this.selectedItems().length > 0) {
            const selectedValue = this.selectedItems()[0];
            this.model.setProperty("inputValue", selectedValue);
            for (let i = 0; i < this.editorSections().length; i++) {
                const section = this.editorSections()[i];
                const editor = section.editors().find(edit => edit.propertyName === "inputValue");
                if (editor) {
                    editor.propertyValue(selectedValue);
                    return;
                }
            }
        }
    }

    private copyNameToValue(newValue) {
        if (this.itemValueToAdd() === this.itemNameToAdd()) {
            setTimeout(() => {
                this.itemValueToAdd(this.itemNameToAdd());
            }, 100);
        }
    }
}