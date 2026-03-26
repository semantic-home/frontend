import {API_BASE} from "./config.ts";

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
            headers: {
                Accept: "application/json",
                ...(init.headers ?? {}),
            }
        }
    )
    if (!res.ok) {
        let detail: unknown = null;
        try {
            const data = await res.json()
            detail = data.detail ?? data

        } catch {
            detail = await res.text()
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
