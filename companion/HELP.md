# Analog Way Midra

## Overview

With this module you can control graphic switchers from the legacy Midra series by Analog Way, e.g. the Pulse2 or Pulse 3G, and the related Eikos / EKS-500 using its TPP command set.

This module does not control models from the new Midra 4K series.

If you want to control devices from Midra 4K series or Alta 4K series, please use the Analog Way AWJ module.

## Connection Notes

Midra Series devices allow only one connection to the ethernet port at the same time.

You can either use RCS2 or Companion, but not both simultaneously.

If you want to connect both at the same time you have to use a connection proxy like the AW Gateway app from Analog Way.

This module only supports ethernet connections to port 10500 of the device, serial connections are not supported.

## Model Notes

In Analog Way model names, the `- H` suffix denotes the HDBaseT variants of the Midra products.

Examples include Pulse2 - H, SmartMatriX2 - H, QuickMatriX - H, and Saphyr - H.

## Memories

When working with memories keep in mind that only eight memories are stored on the device.

You can't use the additional memories provided by RCS2 from anything else than RCS2 itself.

Only the first eight memories are available from Companion.

## Presets

The module includes presets for takes, memories, preview layer input selection, freeze controls, quick frame controls, and Eikos / EKS-500 input, frame, logo, and user preset recalls.

## Feedback Notes

Preset feedbacks show the last matching state sent by this Companion instance.

They do not claim live readback if the same device state is changed from the front panel, RCS2, or another controller.
