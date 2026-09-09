<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useDeviceStore } from "@/stores/deviceStore";
import NocHeader from "@/components/organisms/NocHeader/NocHeader.vue";
import MetricGrid from "@/components/organisms/MetricGrid/MetricGrid.vue";
import TrafficChart from "@/components/organisms/TrafficChart/TrafficChart.vue";
import type { DeviceMeta, DeviceStatus } from "@/types";

const emit = defineEmits<{
  (e: "logout"): void;
}>();

const deviceStore = useDeviceStore();

const { connected, ssid, ipAddress, device_name, iface, traffic_history } = storeToRefs(deviceStore);

const deviceMeta = computed<DeviceMeta>(() => ({
  name: device_name.value || "",
  ip: ipAddress.value,
  interface: iface.value || "",
}));
</script>

<template>
  <div class="min-h-screen bg-canvas p-4 sm:p-6 lg:p-8 font-mono text-main">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Cabecera -->
      <NocHeader
        :connected="connected"
        :deviceMeta="deviceMeta"
        @logout="emit('logout')"
      />

      <!-- Cuadrícula de Métricas -->
      <MetricGrid :device="(deviceStore.$state as DeviceStatus)" />

      <!-- Gráfico de Rendimiento en Vivo -->
      <TrafficChart
        v-if="connected && ssid"
        :history="traffic_history"
      />
    </div>
  </div>
</template>