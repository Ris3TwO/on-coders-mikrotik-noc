<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useDeviceStore } from "@/stores/deviceStore";

import LoginView from "@/components/views/LoginView/LoginView.vue";
import DashboardView from "@/components/views/DashboardView/DashboardView.vue";
import LanguageSelector from "@/components/molecules/LanguageSelector/LanguageSelector.vue";
import { useUpdater } from "@/composables";

const deviceStore = useDeviceStore();
const { isAuthenticated } = storeToRefs(deviceStore);
const { handleLoginSuccess, handleLogout } = deviceStore;

const { isDownloading, updateAvailable, newVersion, checkForUpdates, installUpdate } = useUpdater();

onMounted(async () => {
  await checkForUpdates(true).catch(() => {});
});
</script>

<template>
  <notifications position="top center" :max="3" class="p-4" width="400">
    <template #body="props">
      <div
        class="bg-surface/95 backdrop-blur-md p-3.5 rounded-2xl border shadow-xl flex items-start gap-3 mb-2 font-mono text-xs transition-all"
        :class="{
          'border-red-500/30 text-main': props.item.type === 'error',
          'border-amber-500/30 text-main': props.item.type === 'warn',
          'border-blue-500/30 text-main': props.item.type === 'info',
          'border-muted/20 text-main': !props.item.type || props.item.type === 'success',
        }"
      >
        <!-- Notification type indicator dot -->
        <div
          class="w-2 h-2 rounded-full mt-1 shrink-0"
          :class="{
            'bg-red-500': props.item.type === 'error',
            'bg-amber-500': props.item.type === 'warn',
            'bg-blue-500': props.item.type === 'info',
            'bg-accent': !props.item.type || props.item.type === 'success',
          }"
        ></div>

        <!-- Notification content container -->
        <div class="flex-1">
          <p class="font-bold text-main tracking-tight">
            {{ props.item.title }}
          </p>
          <p class="text-muted mt-0.5 leading-relaxed">{{ props.item.text }}</p>
        </div>

        <!-- Dismiss button -->
        <button
          @click="props.close"
          class="text-muted hover:text-main transition p-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </template>
  </notifications>

  <!-- Clean fixed top bar for global controls -->
  <header
    class="w-full px-6 py-3 flex justify-end items-center border-b border-muted/10 bg-surface/30 backdrop-blur-sm z-50"
  >
    <LanguageSelector />
  </header>

  <!-- Persistent Update Banner -->
  <transition name="fade">
    <div
      v-if="updateAvailable"
      class="w-full bg-brand-turquoise/10 border-b border-brand-turquoise/30 px-6 py-2.5 flex items-center justify-between text-xs font-mono z-40"
    >
      <div class="flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-brand-turquoise animate-pulse"></span>
        <span class="text-main">
          {{ $t("updater.banner.text", { version: newVersion }) }}
        </span>
      </div>

      <button
        @click="installUpdate"
        :disabled="isDownloading"
        class="px-3 py-1 font-semibold text-surface bg-brand-turquoise hover:bg-brand-turquoise/90 rounded-lg transition disabled:opacity-50 cursor-pointer"
      >
        {{ isDownloading ? $t("updater.banner.updating") : $t("updater.banner.action") }}
      </button>
    </div>
  </transition>

  <!-- Main Dashboard View (Organizes Header, MetricGrid, and TrafficChart) -->
  <DashboardView v-if="isAuthenticated" @logout="handleLogout" />

  <!-- Atomic login view -->
  <LoginView v-else @login-success="handleLoginSuccess" />
</template>
