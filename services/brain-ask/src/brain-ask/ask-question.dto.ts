import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class AskQuestionDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  question!: string;
}
