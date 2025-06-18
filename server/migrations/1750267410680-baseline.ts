import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1750267410680 implements MigrationInterface {
    name = 'Baseline1750267410680'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "action_event" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "newStatus" character varying NOT NULL, "sendNotifsTo" text NOT NULL, "date" TIMESTAMP NOT NULL, "updateDate" TIMESTAMP NOT NULL DEFAULT now(), "showInTimeline" boolean NOT NULL DEFAULT false, "actionId" integer, CONSTRAINT "PK_f1514b15f14d59f574b8bb43185" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."action_status_enum" AS ENUM('active', 'upcoming', 'past', 'draft')`);
        await queryRunner.query(`CREATE TYPE "public"."action_type_enum" AS ENUM('Funding', 'Activity', 'Ongoing')`);
        await queryRunner.query(`CREATE TABLE "action" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "category" character varying NOT NULL, "whyJoin" character varying NOT NULL, "image" character varying, "description" character varying NOT NULL, "shortDescription" character varying, "howTo" character varying, "timeEstimate" character varying, "status" "public"."action_status_enum" NOT NULL DEFAULT 'draft', "type" "public"."action_type_enum" NOT NULL DEFAULT 'Activity', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2d9db9cf5edfbbae74eb56e3a39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_action_status_enum" AS ENUM('completed', 'joined', 'seen', 'declined', 'none')`);
        await queryRunner.query(`CREATE TABLE "user_action" ("id" SERIAL NOT NULL, "status" "public"."user_action_status_enum" NOT NULL DEFAULT 'none', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "dateCommitted" TIMESTAMP, "dateCompleted" TIMESTAMP, "deadline" TIMESTAMP, "userId" integer, "actionId" integer, CONSTRAINT "UQ_649286366665d12427427df5439" UNIQUE ("userId", "actionId"), CONSTRAINT "PK_d035e078f4d722c689a98556169" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "communique" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "bodyText" text NOT NULL, "headerImage" character varying, "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateUpdated" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de72f01ed4a95e4bd9f26dcb833" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" SERIAL NOT NULL, "category" character varying NOT NULL, "message" character varying NOT NULL, "webAppLocation" character varying, "mobileAppLocation" character varying, "read" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."friend_status_enum" AS ENUM('pending', 'accepted', 'declined', 'none')`);
        await queryRunner.query(`CREATE TABLE "friend" ("id" SERIAL NOT NULL, "status" "public"."friend_status_enum" NOT NULL DEFAULT 'none', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "acceptedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "requesterId" integer, "addresseeId" integer, "sentNotifId" integer, "acceptedNotifId" integer, CONSTRAINT "UQ_907157e850aae30cf8189e9cc54" UNIQUE ("requesterId", "addresseeId"), CONSTRAINT "REL_aa669daa3adf8f99c1b7e818e1" UNIQUE ("sentNotifId"), CONSTRAINT "REL_25e9f5c2b6bc3e9d3113071693" UNIQUE ("acceptedNotifId"), CONSTRAINT "PK_1b301ac8ac5fcee876db96069b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "city" ("id" integer NOT NULL, "name" character varying NOT NULL, "admin1" character varying(20) NOT NULL, "admin2" character varying(80) NOT NULL, "countryCode" character varying(2) NOT NULL, "countryName" character varying NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, CONSTRAINT "PK_b222f51ce26f7e5ca86944a6739" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "admin" boolean NOT NULL DEFAULT false, "profilePicture" character varying, "profileDescription" character varying, "over18" boolean, "onboardingComplete" boolean NOT NULL DEFAULT false, "referredById" integer, "cityId" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "prefill_user" ("id" SERIAL NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying NOT NULL, "cityId" integer, CONSTRAINT "PK_340c83004e4f9df9b9807750f71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "mail" ("id" SERIAL NOT NULL, "sentMessageId" text, "to" character varying NOT NULL, "status" character varying NOT NULL, "emailType" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5407da42b983ba54c6c62d462d3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "image" ("id" SERIAL NOT NULL, "filename" character varying NOT NULL, "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateUpdated" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d6db1ab4ee9ad9dbe86c64e4cc3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "post" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "content" text NOT NULL, "authorId" integer NOT NULL, "actionId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_be5fda3aac270b134ff9c21cdee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reply" ("id" SERIAL NOT NULL, "content" text NOT NULL, "authorId" integer NOT NULL, "postId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "notificationId" integer, CONSTRAINT "REL_8719410a5e31eaac3bda60a89c" UNIQUE ("notificationId"), CONSTRAINT "PK_94fa9017051b40a71e000a2aff9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "communique_users_read" ("communiqueId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_6c4af504a28d4d007a34ec09029" PRIMARY KEY ("communiqueId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2478cc32e836d8a58fad381813" ON "communique_users_read" ("communiqueId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb01ab97e2366a49a2045d91f3" ON "communique_users_read" ("userId") `);
        await queryRunner.query(`ALTER TABLE "action_event" ADD CONSTRAINT "FK_18c6fac65146d867a3b8b721262" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "FK_c025478b45e60017ed10c77f99c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "FK_d3240b1f0d4d106ca61ea874fdf" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_77431e45d96b9c20941edf49df2" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_e482969c0ef69f005533209143e" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_aa669daa3adf8f99c1b7e818e1a" FOREIGN KEY ("sentNotifId") REFERENCES "notification"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "FK_25e9f5c2b6bc3e9d31130716931" FOREIGN KEY ("acceptedNotifId") REFERENCES "notification"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_adc492faf309ebf60ca6425e183" FOREIGN KEY ("referredById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_beb5846554bec348f6baf449e83" FOREIGN KEY ("cityId") REFERENCES "city"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prefill_user" ADD CONSTRAINT "FK_b94d6c2a51a9d969bc628b225d4" FOREIGN KEY ("cityId") REFERENCES "city"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_7e0117be72db6790be8567374f3" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reply" ADD CONSTRAINT "FK_9c7aa85b4b2be67c1b7235d03fe" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reply" ADD CONSTRAINT "FK_650bb493bc96cdc1c6a95d50ccd" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reply" ADD CONSTRAINT "FK_8719410a5e31eaac3bda60a89c3" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "communique_users_read" ADD CONSTRAINT "FK_2478cc32e836d8a58fad381813e" FOREIGN KEY ("communiqueId") REFERENCES "communique"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "communique_users_read" ADD CONSTRAINT "FK_cb01ab97e2366a49a2045d91f3b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "communique_users_read" DROP CONSTRAINT "FK_cb01ab97e2366a49a2045d91f3b"`);
        await queryRunner.query(`ALTER TABLE "communique_users_read" DROP CONSTRAINT "FK_2478cc32e836d8a58fad381813e"`);
        await queryRunner.query(`ALTER TABLE "reply" DROP CONSTRAINT "FK_8719410a5e31eaac3bda60a89c3"`);
        await queryRunner.query(`ALTER TABLE "reply" DROP CONSTRAINT "FK_650bb493bc96cdc1c6a95d50ccd"`);
        await queryRunner.query(`ALTER TABLE "reply" DROP CONSTRAINT "FK_9c7aa85b4b2be67c1b7235d03fe"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_7e0117be72db6790be8567374f3"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0"`);
        await queryRunner.query(`ALTER TABLE "prefill_user" DROP CONSTRAINT "FK_b94d6c2a51a9d969bc628b225d4"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_beb5846554bec348f6baf449e83"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_adc492faf309ebf60ca6425e183"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_25e9f5c2b6bc3e9d31130716931"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_aa669daa3adf8f99c1b7e818e1a"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_e482969c0ef69f005533209143e"`);
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "FK_77431e45d96b9c20941edf49df2"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "FK_d3240b1f0d4d106ca61ea874fdf"`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "FK_c025478b45e60017ed10c77f99c"`);
        await queryRunner.query(`ALTER TABLE "action_event" DROP CONSTRAINT "FK_18c6fac65146d867a3b8b721262"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb01ab97e2366a49a2045d91f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2478cc32e836d8a58fad381813"`);
        await queryRunner.query(`DROP TABLE "communique_users_read"`);
        await queryRunner.query(`DROP TABLE "reply"`);
        await queryRunner.query(`DROP TABLE "post"`);
        await queryRunner.query(`DROP TABLE "image"`);
        await queryRunner.query(`DROP TABLE "mail"`);
        await queryRunner.query(`DROP TABLE "prefill_user"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "city"`);
        await queryRunner.query(`DROP TABLE "friend"`);
        await queryRunner.query(`DROP TYPE "public"."friend_status_enum"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TABLE "communique"`);
        await queryRunner.query(`DROP TABLE "user_action"`);
        await queryRunner.query(`DROP TYPE "public"."user_action_status_enum"`);
        await queryRunner.query(`DROP TABLE "action"`);
        await queryRunner.query(`DROP TYPE "public"."action_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."action_status_enum"`);
        await queryRunner.query(`DROP TABLE "action_event"`);
    }

}
