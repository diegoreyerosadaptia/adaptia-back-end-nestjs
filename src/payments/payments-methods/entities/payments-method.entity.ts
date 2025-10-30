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

  @Column('json')
  details: JSON;

  @Column('varchar')
  paymentId: string;

  @ManyToOne(() => User, (user) => user.paymentMethod)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
