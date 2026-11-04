<template>
  <div class="lfd-calib no-drag">
    <div class="lfd-calib__group">
      <div class="lfd-calib__group-label">Lenticular (Vision)</div>
      <div class="lfd-calib__row">
        <span class="lfd-calib__name">pe</span>
        <NumberInputWithSlider
          v-model="form.pe"
          :step="0.001"
          :min="1"
          :max="64"
          :format="fmt3"
          @change="apply"
        />
      </div>
      <div class="lfd-calib__row">
        <span class="lfd-calib__name">angle</span>
        <NumberInputWithSlider
          v-model="form.angle"
          :step="0.0001"
          :min="-1.5"
          :max="1.5"
          :format="fmt4"
          @change="apply"
        />
      </div>
      <div class="lfd-calib__row">
        <span class="lfd-calib__name">offset</span>
        <NumberInputWithSlider
          v-model="form.offset"
          :step="0.001"
          :min="-64"
          :max="64"
          :format="fmt3"
          @change="apply"
        />
      </div>
    </div>

    <div class="lfd-calib__group">
      <div class="lfd-calib__group-label">Disparity</div>
      <div class="lfd-calib__row">
        <span class="lfd-calib__name">parallax</span>
        <NumberInputWithSlider
          v-model="form.parallaxScale"
          :step="0.1"
          :min="-64"
          :max="64"
          :format="fmt2"
          @change="apply"
        />
      </div>
    </div>

    <button class="lfd-calib__reset no-drag" type="button" @click="resetDefault">
      重置为默认
    </button>
  </div>
</template>

<script setup>
import { reactive, toRaw } from 'vue';
import NumberInputWithSlider from '@/components/ui/NumberInputWithSlider.vue';
import {
  createViewportUiCalibrationStore,
  normalizeLightFieldCalibration,
  DEFAULT_LIGHT_FIELD_CALIBRATION,
} from '@/utils/viewportUiMode.js';

// dock 面板与 MainPage 用同一固定 key 持久化（标定按显示而非按相机），保证两端一致。
const DESCRIPTOR = {};
const store = createViewportUiCalibrationStore();
const form = reactive(normalizeLightFieldCalibration(store.get(DESCRIPTOR)));

const fmt2 = (v) => Number(v).toFixed(2);
const fmt3 = (v) => Number(v).toFixed(3);
const fmt4 = (v) => Number(v).toFixed(4);

const apply = () => {
  const calibration = { ...toRaw(form) };
  store.set(DESCRIPTOR, calibration);
};

const resetDefault = () => {
  Object.assign(form, normalizeLightFieldCalibration(DEFAULT_LIGHT_FIELD_CALIBRATION));
  apply();
};

</script>

<style scoped>
.lfd-calib {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  background: #141d16;
  color: #e8ede3;
}

.lfd-calib__group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.lfd-calib__group-label {
  color: #9a9a9a;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lfd-calib__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lfd-calib__name {
  color: #e8ede3;
  font-size: 10px;
  min-width: 52px;
}

.lfd-calib__reset {
  align-self: flex-start;
  margin-top: 2px;
  padding: 3px 10px;
  font-size: 10px;
  color: #cbd5e1;
  background: #263126;
  border: 1px solid #2b362d;
  border-radius: 4px;
  cursor: pointer;
}

.lfd-calib__reset:hover {
  background: #353535;
  border-color: #b3995d;
}
</style>
