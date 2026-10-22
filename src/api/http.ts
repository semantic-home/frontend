import {API_BASE} from "./config.ts";
import {buildSessionHeader} from "./session.ts";

export class ApiError extends Error {
    status: number
    detail: unknown

    constructor(status: number, detail: unknown) {
        super(`HTTP ${status}`)
        this.name = "ApiError"
        this.status = status
        this.detail = detail
    }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(
        `${API_BASE}${path}`, {
            ...init,
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...buildSessionHeader(),
                ...(init.headers ?? {}),
            }
        }
    )
    if (!res.ok) {
        let detail: unknown = null;
        const raw = await res.text()
        try {
            const data = JSON.parse(raw)
            detail = data.detail ?? data

        } catch {
            detail = raw
        }
        throw new ApiError(res.status, detail)
    }
    if (res.status === 204) {
        return undefined as T;
    }

    return (await res.json()) as T;
}

export function httpGet<T>(path: string): Promise<T> {
    return request<T>(path, {method: "GET"});
}

export function httpPost<T>(path: string, body: unknown): Promise<T> {
    return request<T>(
        path,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        }
    );
}

export function httpPut<T>(path: string, body: unknown): Promise<T> {
    return request<T>(
        path,
        {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        }
    );
}

export function httpDelete<T>(path: string): Promise<T> {
    return request<T>(path, {method: "DELETE"});
}
