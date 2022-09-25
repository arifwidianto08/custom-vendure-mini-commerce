import {
	CreatePaymentResult,
	CreateRefundResult,
	Injector,
	LanguageCode,
	PaymentMethodHandler,
	SettlePaymentResult,
} from '@vendure/core';
import { XenditService } from './xendit.service';

let xenditService: XenditService;

/**
 * The handler for Xendit payments.
 */
export const xenditPaymentMethodHandler = new PaymentMethodHandler({
	code: 'xendit',

	description: [{ languageCode: LanguageCode.en, value: 'Xendit payments' }],

	args: {},

	init(injector: Injector) {
		xenditService = injector.get(XenditService);
	},

	async createPayment(
		ctx,
		_order,
		amount,
		___,
		metadata,
	): Promise<CreatePaymentResult> {
		// Payment is already settled in Xendit by the time the webhook in xendit.controller.ts
		// adds the payment to the order
		// if (ctx.apiType !== 'admin') {
		// 	throw Error(`CreatePayment is not allowed for apiType '${ctx.apiType}'`);
		// }

		return {
			amount,
			state: 'Settled' as const,
			transactionId: metadata.xenditPaymentId,
			metadata: metadata,
		};
	},

	settlePayment(): SettlePaymentResult {
		return {
			success: true,
		};
	},

	async createRefund(
		_ctx,
		_input,
		_amount,
		_order,
		payment,
		_args,
	): Promise<CreateRefundResult> {
		return {
			state: 'Settled' as const,
			transactionId: payment.transactionId,
		};
	},
});
