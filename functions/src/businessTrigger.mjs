import { getFirestore } from "firebase-admin/firestore";
import { getApp } from "firebase-admin/app";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  projectBusinessSource,
  invalidateBusinessSummary,
} from "./businessSummary.mjs";
const trigger = (kind) =>
  onDocumentWritten(
    {
      document: `${kind}/{sourceId}`,
      region: "southamerica-east1",
      maxInstances: 2,
      concurrency: 4,
      retry: true,
    },
    async (event) => {
      // These aggregates are part of the staging rollout only.
      if (
        getApp().options.projectId !== "vestika-staging" &&
        process.env.GCLOUD_PROJECT !== "vestika-staging"
      )
        throw new Error("Staging-only business summary");
      try {
        await projectBusinessSource(
          getFirestore(),
          kind,
          event.params.sourceId,
        );
      } catch (error) {
        if (
          /^(Invalid business|Missing business|Business company|Invalid financial date|Business source exceeds)/.test(
            error.message,
          )
        ) {
          await invalidateBusinessSummary(
            getFirestore(),
            kind,
            event.params.sourceId,
          );
          return;
        }
        throw error;
      }
    },
  );
export const businessSalesChanged = trigger("sales");
export const businessLayawaysChanged = trigger("layaways");
export const businessIncidentsChanged = trigger("incidents");
export const businessExpensesChanged = trigger("expenses");
export const businessInventoryChanged = trigger("inventory");
