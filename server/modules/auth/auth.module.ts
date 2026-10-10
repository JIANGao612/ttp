import {Global, Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';

@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'ttp-default-secret-change-me',
            signOptions: {expiresIn: (process.env.JWT_EXPIRES_IN ?? '365d') as any},
            //                                                              ↑ 加 as any
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService, JwtModule],
})
export class AuthModule {
}