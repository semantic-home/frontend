import {httpDelete, httpGet, httpPost, httpPut} from "./http.ts";
import type {DomainKey} from "../header/domains.ts";

export function makeRuleApiCall<TCreate, TView>(domain: DomainKey) {
    return {
        upsert: (controllerId: string, req: TCreate) =>
            httpPut<TView>(`/domains/${domain}/controllers/${controllerId}/rule`, req),
        get: (controllerId: string) =>
            httpGet<TView>(`/domains/${domain}/controllers/${controllerId}/rule`),
        delete: (controllerId: string) =>
            httpDelete<{deleted: boolean; controller_id: string}>(`/domains/${domain}/controllers/${controllerId}/rule`),
        preview: (controllerId: string, req: TCreate) =>
            httpPost<TView>(`/domains/${domain}/controllers/${controllerId}/rule/preview`, req),
    }
}
