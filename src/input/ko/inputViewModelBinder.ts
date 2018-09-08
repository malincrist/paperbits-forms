import { InputModel } from "../inputModel";
import { InputViewModel } from "./inputViewModel";
import { IViewModelBinder } from "@paperbits/common/widgets";

interface InputModelRegistration {
    displayName: string;
    inputClass: new () => InputModel;
}

export class GenericInputViewModelBinder implements IViewModelBinder<InputModel, InputViewModel>  {
    private inputs: InputModelRegistration[];

    constructor() {
        this.inputs = [];
    }

    public registerInput(displayName: string, inputModelClass: new () => InputModel): void {
        this.inputs.push({ displayName: displayName, inputClass: inputModelClass });
    }

    public modelToViewModel(model: InputModel, readonly: boolean, viewModel?: InputViewModel): InputViewModel {
        if (!viewModel) {
            viewModel = new InputViewModel(model);
        }
        else {
            viewModel.inputData(model);
        }

        const registration = this.inputs.find(x => model instanceof x.inputClass);

        const binding = {
            displayName: registration.displayName,
            model: model,
            editor: "input-editor",
            applyChanges: () => {
                this.modelToViewModel(model, readonly, viewModel);
            }
        };

        viewModel["widgetBinding"] = binding;

        return viewModel;
    }

    public canHandleModel(model: InputModel): boolean {
        return this.inputs.some(x => model instanceof x.inputClass);
    }
}