import dotenv from "dotenv";
import expressService from "./services/express.service";
import sequelizeService from "./services/sequelize.service";
import awsService from "./services/aws.service";
import mcpService from "../mcp/index";
dotenv.config();

/*
  The MCP / ag-ui / Ollama layer is the core of this app and must come up even
  when the database or AWS aren't configured, so it is initialized first and the
  remaining (optional) services are best-effort: a failure there is logged but
  does not bring the process down.
*/
const requiredServices = [{ name: "mcp", service: mcpService }];
const optionalServices = [
  { name: "express", service: expressService },
  { name: "aws", service: awsService },
  { name: "sequelize", service: sequelizeService },
];

(async () => {
  try {
    for (const { service } of requiredServices) {
      await service.init();
    }

    for (const { name, service } of optionalServices) {
      try {
        await service.init();
      } catch (error) {
        console.warn(
          `[BOOT] Optional service "${name}" failed to initialize (continuing):`,
          error?.message || error
        );
      }
    }

    console.log("Server initialized.");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
