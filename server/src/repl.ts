import { repl } from "@nestjs/core";
import { AppModule } from "./app.module";

void repl(AppModule);
