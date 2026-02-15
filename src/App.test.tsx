import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import seedData from "./data/foods.seed.json"

vi.mock("./data/db", () => {
  let profiles = [
    {
      id: "profile-1",
      name: "Bebe",
      shareCode: "share-1",
      updatedAt: new Date().toISOString(),
    },
  ]
  let snapshot = {
    schemaVersion: 1,
    profileId: "profile-1",
    profileName: "Bebe",
    shareCode: "share-1",
    babyName: "Bebe",
    babyBirthDate: "2099-01-01",
    correctedWeeks: 0,
    revision: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      theme: "system",
      language: "es",
      hideIntroduced: false,
      showHidden: false,
      showNotSuitableFoods: false,
    },
    foods: {},
    order: [],
    meta: {
      orderUpdatedAt: new Date().toISOString(),
    },
  }
  return {
    SNAPSHOT_SCHEMA_VERSION: 1,
    getProfiles: vi.fn(async () => profiles),
    saveProfiles: vi.fn(async (next) => {
      profiles = next
    }),
    getSnapshot: vi.fn(async () => snapshot),
    saveSnapshot: vi.fn(async (next) => {
      snapshot = next
    }),
  }
})

import App from "./App"

const seed = seedData as
  | { foods: { id: string; name: string }[] }
  | { id: string; name: string }[]
const foodsSeed = Array.isArray(seed) ? seed : seed.foods

const createResponse = (status: number, data: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

const setupFetchMock = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/sync/pull")) {
      return createResponse(404, {})
    }
    if (url.includes("/api/sync/push")) {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      const revision = Number(body.baseRevision || 0) + 1
      return createResponse(200, { snapshot: body.snapshot, revision })
    }
    return createResponse(200, {})
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const renderApp = () => {
  return render(<App />)
}

describe("App", () => {
  beforeEach(() => {
    setupFetchMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders home view", async () => {
    renderApp()
    expect(await screen.findByText("Familias")).toBeInTheDocument()
    expect(screen.getByText("Todos los alimentos")).toBeInTheDocument()
  })

  it("navigates to catalog", async () => {
    renderApp()
    const openList = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await userEvent.click(openList)
    expect(screen.getByPlaceholderText("Buscar alimento")).toBeInTheDocument()
  })

  it("exports full payload", async () => {
    renderApp()

    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    const settingsButton = await screen.findByRole("button", { name: "Ajustes" })
    await userEvent.click(settingsButton)

    const exportButton = await screen.findByRole("button", {
      name: "Exportar perfil",
    })
    await userEvent.click(exportButton)

    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalled()
    })

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob
    const text = await blob.text()
    const parsed = JSON.parse(text) as {
      seed: { foods: { id: string }[] }
      snapshot: { foods: Record<string, { description?: string }> }
    }

    expect(parsed.seed.foods.length).toBeGreaterThan(0)
    const firstFoodId = foodsSeed[0].id
    expect(parsed.snapshot.foods[firstFoodId]).toBeDefined()
    expect(parsed.snapshot.foods[firstFoodId].description).toBeDefined()
  })

  it("imports snapshot data", async () => {
    renderApp()

    const settingsButton = await screen.findByRole("button", { name: "Ajustes" })
    await userEvent.click(settingsButton)

    const payload = {
      exportedAt: new Date().toISOString(),
      seed: seedData,
      snapshot: {
        schemaVersion: 1,
        profileId: "profile-imported",
        profileName: "Importado",
        shareCode: "share-imported",
        revision: 1,
        updatedAt: new Date().toISOString(),
        settings: {
          theme: "system",
          hideIntroduced: true,
          showHidden: true,
        },
        foods: {},
        order: [foodsSeed[0].id],
        meta: {},
      },
    }

    const file = new File([JSON.stringify(payload)], "tribitr.json", {
      type: "application/json",
    })
    const input = document.querySelector(
      "input[type=\"file\"]"
    ) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      const selector = screen.getByRole("button", {
        name: "Seleccionar perfil",
      })
      expect(selector).toHaveTextContent("Importado")
    })

    const backButton = await screen.findByRole("button", { name: "Volver" })
    await userEvent.click(backButton)

    const cta = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await userEvent.click(cta)

    const hideToggle = screen.getByRole("checkbox", {
      name: "Ocultar 3/3",
    }) as HTMLInputElement
    const showToggle = screen.getByRole("checkbox", {
      name: "Mostrar ocultos",
    }) as HTMLInputElement

    await waitFor(() => {
      expect(hideToggle.checked).toBe(true)
      expect(showToggle.checked).toBe(true)
    })
  })

  it("pushes changes to sync", async () => {
    const user = userEvent.setup()
    const fetchMock = setupFetchMock()
    renderApp()

    const cta = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await user.click(cta)

    const initialPushCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/sync/push")
    ).length

    await waitFor(() => {
      const pullCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/api/sync/pull")
      ).length
      expect(pullCalls).toBeGreaterThan(0)
    })

    const firstCheck = await screen.findAllByText("1")
    await user.click(firstCheck[0])

    await waitFor(
      () => {
        const pushCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes("/api/sync/push")
        ).length
        expect(pushCalls).toBeGreaterThan(initialPushCalls)
      },
      { timeout: 3000 }
    )
  })

  it("shows not suitable foods with warning when enabled in settings", async () => {
    const user = userEvent.setup()
    renderApp()

    const settingsButton = await screen.findByRole("button", { name: "Ajustes" })
    await user.click(settingsButton)

    const birthDateInput = await screen.findByLabelText("Fecha de nacimiento")
    fireEvent.change(birthDateInput, { target: { value: "2099-01-01" } })

    const showNotSuitableToggle = await screen.findByRole("checkbox", {
      name: "Mostrar no aptos todavia",
    })
    if ((showNotSuitableToggle as HTMLInputElement).checked) {
      await user.click(showNotSuitableToggle)
    }

    const saveProfileButton = screen.getByRole("button", { name: "Guardar ficha" })
    await user.click(saveProfileButton)

    const backFromSettings = await screen.findByRole("button", { name: "Volver" })
    await user.click(backFromSettings)

    const cta = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await user.click(cta)

    const settingsButtonAgain = await screen.findByRole("button", { name: "Ajustes" })
    await user.click(settingsButtonAgain)

    const showNotSuitableToggleInSettings = await screen.findByRole("checkbox", {
      name: "Mostrar no aptos todavia",
    })
    await user.click(showNotSuitableToggleInSettings)

    const backButton = await screen.findByRole("button", { name: "Volver" })
    await user.click(backButton)

    const openListAgain = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await user.click(openListAgain)

    expect(await screen.findByText("Atun")).toBeInTheDocument()
    expect(screen.getAllByText(/\+12m/).length).toBeGreaterThan(0)
  })

  it("shows and dismisses cookie notice", async () => {
    const user = userEvent.setup()
    renderApp()

    expect(
      await screen.findByText("Usamos almacenamiento local para guardar progreso y sincronizacion.")
    ).toBeInTheDocument()

    const okButton = screen.getByRole("button", { name: "Entendido" })
    await user.click(okButton)

    await waitFor(() => {
      expect(
        screen.queryByText("Usamos almacenamiento local para guardar progreso y sincronizacion.")
      ).not.toBeInTheDocument()
    })
  })

  it("generates description via ai endpoint", async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/sync/pull")) {
        return createResponse(404, {})
      }
      if (url.includes("/api/sync/push")) {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const revision = Number(body.baseRevision || 0) + 1
        return createResponse(200, { snapshot: body.snapshot, revision })
      }
      if (url.includes("/api/ai/food")) {
        return createResponse(200, {
          description: "Descripcion generada",
          reactions: "Reacciones generadas",
          model: "test-model",
        })
      }
      return createResponse(200, {})
    })
    vi.stubGlobal("fetch", fetchMock)

    renderApp()

    const cta = await screen.findByRole("button", {
      name: /Todos los alimentos/i,
    })
    await user.click(cta)

    expect(await screen.findByPlaceholderText("Buscar alimento")).toBeInTheDocument()

    const firstFood = await screen.findByRole("button", {
      name: foodsSeed[0].name,
    })
    await user.click(firstFood)

    expect(await screen.findByText("Descripcion")).toBeInTheDocument()

    expect(await screen.findByText("Descripcion generada")).toBeInTheDocument()
    expect(await screen.findByText("Reacciones generadas")).toBeInTheDocument()
  })
})
