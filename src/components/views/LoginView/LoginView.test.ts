import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import LoginView from "@/components/views/LoginView/LoginView.vue";
import { createI18n } from "vue-i18n";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useDeviceStore } from "@/stores/deviceStore";

const mockIp = ref("192.168.88.1");
const mockUser = ref("admin");
const mockPass = ref("secret");
const mockRememberPass = ref(false);
const mockIsLoading = ref(false);
const mockShowPassword = ref(false);

let capturedCallback: ((creds: any) => void) | null = null;

vi.mock("@/composables", () => ({
  useAuth: (onSuccess: (creds: any) => void) => {
    capturedCallback = onSuccess;
    return {
      ip: mockIp,
      user: mockUser,
      pass: mockPass,
      rememberPass: mockRememberPass,
      isLoading: mockIsLoading,
      showPassword: mockShowPassword,
      handleLogin: () => {
        if (capturedCallback) {
          capturedCallback({
            ip: mockIp.value,
            user: mockUser.value,
            pass: mockPass.value,
            remember: mockRememberPass.value,
          });
        }
      },
    };
  },
}));

vi.mock("@/stores/deviceStore", () => ({
  useDeviceStore: vi.fn(() => ({
    handleLoginSuccess: vi.fn(),
  })),
}));

const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: {
    en: {
      login: {
        ip_address: "IP Address",
        username: "Username",
        password: "Password",
        remember_password: "Remember password",
        loginButton: "Connect",
        loginButtonLoading: "Connecting...",
        engine: "Engine",
      },
    },
  },
});

describe("LoginView.vue", () => {
  let pinia: ReturnType<typeof createPinia>;
  let mockHandleLoginSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);

    mockIp.value = "192.168.88.1";
    mockUser.value = "admin";
    mockPass.value = "secret";
    mockRememberPass.value = false;
    mockIsLoading.value = false;
    mockShowPassword.value = false;

    mockHandleLoginSuccess = vi.fn();
    vi.mocked(useDeviceStore).mockReturnValue({
      handleLoginSuccess: mockHandleLoginSuccess,
    } as any);
  });

  const createWrapper = () =>
    mount(LoginView, {
      global: {
        plugins: [pinia, i18n],
      },
    });

  it("should render correctly and execute handleLoginSuccess on submit", async () => {
    const wrapper = createWrapper();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(mockHandleLoginSuccess).toHaveBeenCalledWith({
      ip: "192.168.88.1",
      user: "admin",
      pass: "secret",
      remember: false,
    });
  });

  it("should update input values via NetworkInput bindings", async () => {
    const wrapper = createWrapper();

    const inputs = wrapper.findAllComponents({ name: "NetworkInput" });

    await inputs[0].vm.$emit("update:modelValue", "10.0.0.1");
    await inputs[1].vm.$emit("update:modelValue", "root");
    await inputs[2].vm.$emit("update:modelValue", "my-secure-pass");

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(mockHandleLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "10.0.0.1",
        user: "root",
        pass: "my-secure-pass",
      })
    );
  });

  it("should handle rememberPass checkbox toggle and pass it to store action", async () => {
    const wrapper = createWrapper();

    const checkbox = wrapper.find('input[type="checkbox"]#remember');
    await checkbox.setValue(true);

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(mockHandleLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        remember: true,
      })
    );
  });

  it("should display loading state and change button text when isLoading is true", async () => {
    mockIsLoading.value = true;

    const wrapper = createWrapper();

    const button = wrapper.findComponent({ name: "NetworkButton" });
    expect(button.props("isLoading")).toBe(true);
    expect(wrapper.text()).toContain("Connecting...");
  });

  it("should toggle password visibility", async () => {
    const wrapper = createWrapper();

    const passwordInput = wrapper.findAllComponents({ name: "NetworkInput" })[2];
    await passwordInput.vm.$emit("toggle-password");

    expect(mockShowPassword.value).toBe(true);
  });
});
