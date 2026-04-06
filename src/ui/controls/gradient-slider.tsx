import * as Slider from '@radix-ui/react-slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useState } from 'react';

export interface GradientSliderProps {
  readonly value: number; // 0-100
  readonly onChange: (value: number) => void;
  readonly leftIcon: string;
  readonly rightIcon: string;
  readonly tooltipText?: string;
  readonly label?: string;
}

/**
 * Horizontal gradient slider with emoji icons at both ends.
 * Matches Figma L1 Pacing design: cat(slow) → rabbit(fast).
 */
export function GradientSlider({
  value,
  onChange,
  leftIcon,
  rightIcon,
  tooltipText,
  label,
}: GradientSliderProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-center gap-3 w-full" aria-label={label}>
      <span className="text-xl shrink-0" aria-hidden="true">{leftIcon}</span>

      <Tooltip.Provider delayDuration={0}>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-10"
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={0}
          max={100}
          step={1}
          aria-label={label ?? 'Pacing'}
        >
          <Slider.Track className="relative grow h-2 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            <Slider.Range className="absolute h-full rounded-full" />
          </Slider.Track>

          <Tooltip.Root open={showTooltip}>
            <Tooltip.Trigger asChild>
              <Slider.Thumb
                className="block size-5 rounded-full bg-white shadow-md border border-gray-200
                  hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                  transition-shadow cursor-grab active:cursor-grabbing"
                onPointerDown={() => setShowTooltip(true)}
                onPointerUp={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
              />
            </Tooltip.Trigger>
            {tooltipText && (
              <Tooltip.Portal>
                <Tooltip.Content
                  className="rounded-lg bg-white px-3 py-2 text-sm text-black shadow-lg"
                  sideOffset={8}
                  side="top"
                >
                  {tooltipText}
                  <Tooltip.Arrow className="fill-white" />
                </Tooltip.Content>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </Slider.Root>
      </Tooltip.Provider>

      <span className="text-xl shrink-0" aria-hidden="true">{rightIcon}</span>
    </div>
  );
}
