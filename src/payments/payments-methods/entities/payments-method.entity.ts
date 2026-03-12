import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'payments_methods' })
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('json', { nullable: true })
  details: JSON;

  @Column('varchar', { nullable: true })
  paymentId: string;

  @Column('varchar', { nullable: true })
  preferenceId: string;

  @Column('varchar', { nullable: true })
  organizationId: string;

  @Column('varchar', { nullable: true })
  gaClientId: string;

  @Column('varchar', { default: 'PENDING' })
  status: string;

  @ManyToOne(() => User, (user) => user.paymentMethod)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}