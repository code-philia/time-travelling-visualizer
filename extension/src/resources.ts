import * as vscode from "vscode";

const iconPaths: {[key: string]: string} = {
  "image-type": "resources/imagesmode_24dp_5F6368_FILL0_wght400_GRAD0_opsz24.svg",
  "text-type": "resources/title_24dp_5F6368_FILL0_wght400_GRAD0_opsz24.svg",
  "classification-task": "resources/category_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg",
  "non-classification-task": "resources/circle_24dp_5F6368_FILL0_wght300_GRAD0_opsz24.svg"
};

export function getIconUri(context: vscode.ExtensionContext, iconName: string): vscode.Uri {
  const relativeIconPath = iconPaths[iconName];
  if (relativeIconPath === undefined) {
    throw new Error(`Icon name ${iconName} not found`);
  }
  return vscode.Uri.file(context.asAbsolutePath(relativeIconPath));
}