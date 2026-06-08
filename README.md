# companion-module-analogway-midra

See companion/HELP.md and LICENSE.

## Test Branch Status

This branch adds Eikos / EKS-500 support to the Analog Way Midra module.

It should be hardware-tested before opening a PR.

## Model Notes

In Analog Way model names, the `- H` suffix denotes the HDBaseT variants of the Midra products.

Examples include Pulse2 - H, SmartMatriX2 - H, QuickMatriX - H, and Saphyr - H.

## Eikos / EKS-500 Test Items

- Take command
- Background Live, PIP 2, and PIP 3 input selection
- Background Frame, Logo 1, and Logo 2 selection
- User Preset 1 through 8 recall
- Preset feedback behavior

## Feedback Notes

Preset feedbacks currently track the last matching command sent by this Companion instance.

They do not provide live readback if the same device state is changed from the front panel, RCS2, or another controller.
