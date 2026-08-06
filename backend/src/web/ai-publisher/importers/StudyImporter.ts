import { BaseImporter } from "./BaseImporter";

export class StudyImporter extends BaseImporter {
  public readonly editor = "study" as const;
  public readonly target = "study_lessons";
}
